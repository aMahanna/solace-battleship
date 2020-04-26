package com.solace.battleship.flows;

import com.solace.battleship.events.JoinResult;
import com.solace.battleship.events.PlayerJoined;
import com.solace.battleship.flows.JoinProcessor.JoinRequestBinding;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.Input;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.handler.annotation.Header;

/**
 * This Spring Cloud Stream processor handles join-requests for the Battleship
 * Game
 * 
 * @author Thomas Kunnumpurath
 */
@EnableBinding(JoinRequestBinding.class)
public class JoinProcessor extends AbstractRequestProcessor<PlayerJoined> {

    // We define an INPUT to receive data from and dynamically specify the reply to
    // destination depending on the header and state of the game enginer
    @StreamListener(JoinRequestBinding.INPUT)
    public void handle(PlayerJoined joinRequest, @Header("reply-to") String replyTo) {
        // Pass the request to the game engine to join the game
        JoinResult result = gameEngine.requestToJoinGame(joinRequest);
        // Send the result of the JoinRequest to the replyTo destination retrieved from
        // the message header
        resolver.resolveDestination(replyTo).send(message(result));

        // If the result was a succesful join and if both player's have joined, then
        // publish a game start message
        if (result.isSuccess() && gameEngine.canGameStart(joinRequest.getSessionId())) {
            resolver.resolveDestination("SOLACE/BATTLESHIP/" + joinRequest.getSessionId() + "/GAME-START/CONTROLLER")
                    .send(message(gameEngine.getGameStartAndStartGame(joinRequest.getSessionId())));
        }

    }

    /*
     * Custom Processor Binding Interface to allow for multiple outputs
     */
    public interface JoinRequestBinding {
        String INPUT = "join_request";

        @Input
        SubscribableChannel join_request();
    }
}