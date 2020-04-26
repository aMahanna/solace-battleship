import {
  PlayerJoined,
  GameStart,
  TopicHelper,
  BoardSetEvent,
  JoinResult,
} from "../common/events";
import { inject } from "aurelia-framework";
import { Router } from "aurelia-router";
import { SolaceClient } from "../common/solace-client";

/**
 * Class that represents a landing page
 */
@inject(Router, SolaceClient, TopicHelper, GameStart)
export class LandingPage {
  player1Status: string = "Waiting for Player1 to Join...";
  player2Status: string = "Waiting for Player2 to Join...";
  connectStatus: string = "";

  boardsSet: number = 0;

  constructor(
    private router: Router,
    private solaceClient: SolaceClient,
    private topicHelper: TopicHelper,
    private gameStart: GameStart
  ) {}

  /**
   * Aurelia function that is called when the page is navigated to
   * @param params
   * @param routeConfig
   */
  activate(params, routeConfig) {
    // Connect to Solace
    this.solaceClient
      .connect()
      .then(() => {
        this.connectStatus = "Connected to Solace!";
      })
      .catch((error) => {
        this.connectStatus = `${error}!`;
      });
  }
}
