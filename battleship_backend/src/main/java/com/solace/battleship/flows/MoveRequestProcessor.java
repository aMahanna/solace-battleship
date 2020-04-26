package com.solace.battleship.flows;

import com.solace.battleship.events.Move;
import com.solace.battleship.events.MoveResponseEvent;
import com.solace.battleship.flows.MoveRequestProcessor.MoveRequestBinding;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.Input;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.handler.annotation.Header;

/**
 * This Spring Cloud Stream processor handles move requests for the Battleship
 * Game
 *
 * @author Andrew Roberts
 */
@SpringBootApplication
@EnableBinding(MoveRequestBinding.class)
public class MoveRequestProcessor extends AbstractRequestProcessor<Move> {

  // We define an INPUT to receive data from and dynamically specify the reply to
  // destination depending on the header and state of the game engine
  @StreamListener(MoveRequestBinding.INPUT)
  public void handle(Move moveRequest, @Header("reply-to") String replyTo) {
    // Pass the request to make a move
    MoveResponseEvent result = gameEngine.requestToMakeMove(moveRequest);
    // Send the result of the MoveRequest to the replyTo destination retrieved from
    // the message header
    resolver.resolveDestination(replyTo).send(message(result));
    // Update the board once the move has been made
    gameEngine.updateBoard(result);
    // If the match should be ended due to a score being 0, publish a match end
    // message
    if (gameEngine.shouldMatchEnd(moveRequest.getSessionId())) {
      resolver.resolveDestination("SOLACE/BATTLESHIP/" + moveRequest.getSessionId() + "/MATCH-END/CONTROLLER")
          .send(message(gameEngine.endMatch(moveRequest.getSessionId())));
    }
  }

  /*
   * Custom Processor Binding Interface to allow for multiple outputs
   */
  public interface MoveRequestBinding {
    String INPUT = "move_request";

    @Input
    SubscribableChannel move_request();
  }
}