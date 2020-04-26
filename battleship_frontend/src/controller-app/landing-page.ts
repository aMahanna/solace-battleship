import { BoardSetResult } from "./../common/events";
import { JoinResult } from "../common/events";
import {
  PlayerJoined,
  GameStart,
  TopicHelper,
  BoardSetEvent,
  MatchStart,
} from "../common/events";
import { inject } from "aurelia-framework";
import { Router } from "aurelia-router";
import { SolaceClient } from "common/solace-client";

/**
 * Class that represents a landing page
 */
@inject(Router, SolaceClient, TopicHelper, GameStart)
export class LandingPage {
  private player1Status: string = "Waiting for Player1 to Join...";
  private player2Status: string = "Waiting for Player2 to Join...";

  private boardsSet: number = 0;
  private matchStartResult: MatchStart = new MatchStart();

  //Generate a session-id for the game (a random hex string)
  sessionId: string = Math.floor(Math.random() * 16777215).toString(16);

  constructor(
    private router: Router,
    private solaceClient: SolaceClient,
    private topicHelper: TopicHelper,
    private gameStart: GameStart
  ) {
    //Append a session-id for the global topic prefix
    this.topicHelper.prefix = this.topicHelper.prefix + "/" + this.sessionId;
  }

  /**
   * Aurelia function that is called when the page is navigated to
   * @param params
   * @param routeConfig
   */
  activate(params, routeConfig) {
    // Connect to Solace
    this.solaceClient.connect().then(() => {
      //Listener for join replies from the battleship-server
      this.solaceClient.subscribe(
        `${this.topicHelper.prefix}/JOIN-REPLY/*/CONTROLLER`,
        // join event handler callback
        (msg) => {
          if (msg.getBinaryAttachment()) {
            // parse received event
            let joinResult: JoinResult = JSON.parse(msg.getBinaryAttachment());
            if (joinResult.success) {
              // update client statuses
              if (joinResult.playerName == "player1") {
                this.player1Status = "Player1 Joined!";
              } else {
                this.player2Status = "Player2 Joined!";
              }
            }
          }
        }
      );

      //Listening for a GAME-START event from the battleship-server
      this.solaceClient.subscribe(
        `${this.topicHelper.prefix}/GAME-START/CONTROLLER`,
        // Game-Start event
        (msg) => {
          if (msg.getBinaryAttachment()) {
            let gsObj: GameStart = JSON.parse(msg.getBinaryAttachment());
            this.gameStart.player1 = gsObj.player1;
            this.gameStart.player2 = gsObj.player2;
            this.player1Status = "Waiting for Player1 to set the board";
            this.player2Status = "Waiting for Player2 to set the board";
          }
        }
      );

      //Listener for board set requests
      this.solaceClient.subscribe(
        `${this.topicHelper.prefix}/BOARD-SET-REQUEST/*`,
        // board set event handler
        (msg) => {
          let boardSetResult: BoardSetResult = new BoardSetResult();
          // parse received message
          let boardSetEvent: BoardSetEvent = JSON.parse(
            msg.getBinaryAttachment()
          );
          boardSetResult.playerName = boardSetEvent.playerName;
          //Set the response object appropriately
          if (boardSetEvent.playerName == "player1") {
            if (this.player1Status === "Player1 Board Set!") {
              boardSetResult.message = "Board already set by Player1";
              boardSetResult.success = false;
            } else {
              this.player1Status = "Player1 Board Set!";
              boardSetResult.message = "Board set!";
              boardSetResult.success = true;
              this.matchStartResult.player1Board = boardSetResult;

              this.boardsSet++;
            }
          } else {
            if (this.player2Status === "Player2 Board Set!") {
              boardSetResult.message = "Board already set by Player2";
              boardSetResult.success = false;
            } else {
              this.player2Status = "Player2 Board Set!";
              boardSetResult.message = "Board set!";
              boardSetResult.success = true;
              this.matchStartResult.player2Board = boardSetResult;
              this.boardsSet++;
            }
          }

          //Send the reply
          this.solaceClient.sendReply(msg, JSON.stringify(boardSetResult));

          //If both boards have been set, publish a matchstart event and disconnect the landing page
          if (this.boardsSet == 2) {
            this.solaceClient.publish(
              `${this.topicHelper.prefix}/MATCH-START/CONTROLLER`,
              JSON.stringify(this.matchStartResult)
            );
            this.router.navigateToRoute("dashboard");
          }
        }
      );
    });
  }

  detached() {
    //Unsubscribe from the ../JOIN-REQUEST/* event
    this.solaceClient.unsubscribe(`${this.topicHelper.prefix}/JOIN-REQUEST/*`);
    //Unsubscribe from the ../BOARD-SET-REQUEST/* event
    this.solaceClient.unsubscribe(
      `${this.topicHelper.prefix}/BOARD-SET-REQUEST/*`
    );
  }
}
