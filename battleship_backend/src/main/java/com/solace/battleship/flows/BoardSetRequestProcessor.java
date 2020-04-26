package com.solace.battleship.flows;

import com.solace.battleship.events.BoardSetRequest;
import com.solace.battleship.events.BoardSetResult;
import com.solace.battleship.flows.BoardSetRequestProcessor.BoardSetRequestBinding;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.Input;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.handler.annotation.Header;

/**
 * This Spring Cloud Stream processor handles board set requests for the
 * Battleship Game
 *
 * @author Andrew Roberts
 */
@EnableBinding(BoardSetRequestBinding.class)
public class BoardSetRequestProcessor extends AbstractRequestProcessor<BoardSetRequest> {

  // We define an INPUT to receive data from and dynamically specify the reply to
  // destination depending on the header and state of the game enginer
  @StreamListener(BoardSetRequestBinding.INPUT)
  public void handle(BoardSetRequest boardSetRequest, @Header("reply-to") String replyTo) {
    // Pass the request to the game engine set the board
    BoardSetResult result = gameEngine.requestToSetBoard(boardSetRequest);
    // Send the result of the BoardSetRequest to the replyTo destination retrieved
    // from the message header
    resolver.resolveDestination(replyTo).send(message(result));
    // If the result was a succesful board set and if both player's have joined,
    // then publish a Match Start Message
    if (result.isSuccess() && gameEngine.canMatchStart(boardSetRequest.getSessionId())) {
      resolver.resolveDestination("SOLACE/BATTLESHIP/" + boardSetRequest.getSessionId() + "/MATCH-START/CONTROLLER")
          .send(message(gameEngine.getMatchStartAndStartMatch(boardSetRequest.getSessionId())));
    }

  }

  /*
   * Custom Processor Binding Interface to allow for multiple outputs
   */
  public interface BoardSetRequestBinding {
    String INPUT = "board_set_request";

    @Input
    SubscribableChannel board_set_request();
  }
}