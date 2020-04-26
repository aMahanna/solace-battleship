import { MatchEnd, Move, KnownBoardCellState, MoveResponseEvent, PlayerName, Player, TopicHelper, GameStart } from "../common/events";
import { inject } from "aurelia-framework";
import { Router } from "aurelia-router";
import { SolaceClient } from "../common/solace-client";
import { GameParams } from "../common/game-params";

//type for the state of the page
type PAGE_STATE = "TURN_PLAYER1" | "TURN_PLAYER2";

//Construct that holds the player's scores
class ScoreMap {
  player1: number;
  player2: number;
}

/**
 * A class that represents the match for the player.
 *
 * @authors Thomas Kunnumpurath
 */
@inject(Router, SolaceClient, Player, GameParams, TopicHelper, GameStart)
export class Match {
  //Map of the score
  private scoreMap: ScoreMap = new ScoreMap();

  private pageState: PlayerName = "player1";

  private enemyBoard: KnownBoardCellState[][] = [];

  private turnMessage: string;

  constructor(private router: Router, private solaceClient: SolaceClient, private player: Player, private gameParams: GameParams, private topicHelper: TopicHelper, private gameStart: GameStart) {
    this.scoreMap["player1"] = this.gameParams.allowedShips;
    this.scoreMap["player2"] = this.gameParams.allowedShips;
    for (let i = 0; i < gameParams.gameboardDimensions; i++) {
      this.enemyBoard[i] = [];
      for (let j = 0; j < gameParams.gameboardDimensions; j++) {
        this.enemyBoard[i][j] = "empty";
      }
    }

    //Warm up the reply subscription
    this.solaceClient.subscribeReply(`${this.topicHelper.prefix}/MOVE-REPLY/${this.player.getPlayerNameForTopic()}/${this.player.getOtherPlayerNameForTopic()}`);

    //Subscribe to the other players move response event and update local state accordingly
    this.solaceClient.subscribe(
      `${this.topicHelper.prefix}/MOVE-REPLY/${this.player.getOtherPlayerNameForTopic()}/${this.player.getPlayerNameForTopic()}`,
      // game start event handler callback
      (msg) => {
        //De-serialize the move response into a moveResponseEvent object
        let moveResponseEvent: MoveResponseEvent = JSON.parse(msg.getBinaryAttachment());
        //Update the approrpaite score/icons based on the move response
        if (moveResponseEvent.moveResult == "ship") {
          this.shipHit(moveResponseEvent.player);
        }
        //Change the page state
        this.pageState = this.pageState == "player1" ? "player2" : "player1";
        //Rotate the turn message
        this.rotateTurnMessage();
      }
    );

    //Subscribe to the MATCH-END event
    this.solaceClient.subscribe(
      `${this.topicHelper.prefix}/MATCH-END/CONTROLLER`,
      // game start event handler callback
      (msg) => {
        let matchEndObj: MatchEnd = JSON.parse(msg.getBinaryAttachment());
        if (this.player.name == "player1" && matchEndObj.player1Score == 0) {
          this.router.navigateToRoute("game-over", { msg: "YOU LOSE!" });
        } else if (this.player.name == "player2" && matchEndObj.player2Score == 0) {
          this.router.navigateToRoute("game-over", { msg: "YOU LOSE!" });
        } else {
          this.router.navigateToRoute("game-over", { msg: "YOU WON!" });
        }
      }
    );
  }

  /**
   * Function to rotate the turn page's message
   */
  rotateTurnMessage() {
    if ((this.player.name == "player1" && this.pageState == "player1") || (this.player.name == "player2" && this.pageState == "player2")) {
      this.turnMessage = "YOUR TURN";
    } else if (this.player.name == "player1" && this.pageState == "player2") {
      this.turnMessage = "PLAYER2'S TURN";
    } else {
      this.turnMessage = "PLAYER1'S TURN";
    }
  }

  attached() {
    if (this.player.name == "player1") {
      this.turnMessage = "YOUR TURN";
    } else {
      this.turnMessage = `PLAYER1'S TURN`;
    }
  }

  //A selection for the board
  boardSelectEvent(column: number, row: number) {
    if (this.player.name == this.pageState && this.enemyBoard[column][row] == "empty") {
      let move: Move = new Move();
      move.x = column;
      move.y = row;
      move.player = this.player.name;
      move.sessionId = this.player.sessionId;
      this.solaceClient
        .sendRequest(
          `${this.topicHelper.prefix}/MOVE-REQUEST/${this.player.getPlayerNameForTopic()}`,
          JSON.stringify(move),
          `${this.topicHelper.prefix}/MOVE-REPLY/${this.player.getPlayerNameForTopic()}/${this.player.getOtherPlayerNameForTopic()}`
        )
        .then((msg: any) => {
          //De-serialize the move response into a moveResponseEvent object
          let moveResponseEvent: MoveResponseEvent = JSON.parse(msg.getBinaryAttachment());
          //Update the current player's enemy board's state
          this.enemyBoard = moveResponseEvent.playerBoard;
          if (moveResponseEvent.moveResult == "ship") {
            this.enemyBoard[move.x][move.y] = "hit";
            this.shipHit(this.player.name == "player1" ? "player2" : "player1");
          } else {
            this.enemyBoard[move.x][move.y] = "miss";
          }
          //Change the page state
          this.pageState = this.player.name == "player1" ? "player2" : "player1";
          //Rotate the turn message
          this.rotateTurnMessage();
        })
        .catch((failedMessage) => {
          console.log(failedMessage);
          this.turnMessage += " ...TRY AGAIN!";
        });
    }
  }

  /**
   * Function to decrement the score for a player if a ship is hit
   * @param shipHitOwner the player of the ship that was hit
   */
  shipHit(shipHitOwner: PlayerName) {
    this.scoreMap[shipHitOwner]--;
  }

  detached() {
    //Unsubcsribe for the events
    this.solaceClient.unsubscribe(`${this.topicHelper.prefix}/MOVE-REQUEST/${this.player.getOtherPlayerNameForTopic()}`);
    this.solaceClient.unsubscribe(`${this.topicHelper.prefix}/MOVE-REPLY/${this.player.getPlayerNameForTopic()}/${this.player.getOtherPlayerNameForTopic()}`);
  }
}
