#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var http = require('http');
var activeUsersList = {};
var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8888, function() {
    console.log((new Date()) + ' Server is listening on port 8888');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
	// put logic here to detect whether the specified origin is allowed.
	return true;
}

wsServer.on('request', function(request) {

    if (!originIsAllowed(request.origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
		return;
    }

    var connection = request.accept('http', request.origin);


    console.log((new Date()) + ' Connection accepted.');

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);

            var parsedMessage = JSON.parse(message.utf8Data);

            /**
             * This is the initial user validation on handshake
             * Save the user as "active" and exit;
             *
             */
			if(parsedMessage.messageType === 'signUserIn') {
				connection.userID = parsedMessage.userID;
				activeUsersList[parsedMessage.userID] = connection;
				activeUsersList[parsedMessage.userID].storedChats = {};
				var obj = JSON.parse(message.utf8Data);
				message.utf8Data.list = activeUsersList;
				var arr = [];
				for(var i in activeUsersList) {
					console.log(i)


					if(parsedMessage.userID !== i) {

						//tell every user, that a new user have signed in
						activeUsersList[i].sendUTF(JSON.stringify({
							messageType: 'newSignedUser',
							newSignedUserId: parsedMessage.userID
						}));

						//build the array with currently online users, to send to the newly signed one
						arr.push(i)
					}
				}
				activeUsersList[parsedMessage.userID].sendUTF(JSON.stringify({
					messageType: 'activeUsersList',
					activeUsersList: arr
				}));
				return;
			}

			if('conversationTargetId' in parsedMessage) {


				activeUsersList[parsedMessage.conversationTargetId].sendUTF(message.utf8Data);

				if(parsedMessage.messageType === 'storeChatData') {
					activeUsersList[parsedMessage.userID].storedChats[parsedMessage.conversationTargetId] = parsedMessage.messageAsHTML;
				} else if (parsedMessage.messageType === 'storeAdditionalChatData') {
					activeUsersList[parsedMessage.userID].storedChats[parsedMessage.conversationTargetId] ?
					activeUsersList[parsedMessage.userID].storedChats[parsedMessage.conversationTargetId] += parsedMessage.messageAsHTML :
					activeUsersList[parsedMessage.userID].storedChats[parsedMessage.conversationTargetId] = parsedMessage.messageAsHTML;
				}

				if(parsedMessage.messageType === 'loadStoredChat') {

					activeUsersList[parsedMessage.userID]
						.sendUTF(JSON.stringify({
							messageType: 'storedChat',
							storedChat: activeUsersList[parsedMessage.userID].storedChats[parsedMessage.conversationTargetId]
						}));
				}

				return;
			}

			/*if(parsedMessage.messageType === 'sendToAllUsers') {
				//currently not implementet on client side!
				for(var userName in activeUsersList) {


					if(parsedMessage.userID != userName) {
						activeUsersList[userName].sendUTF(message.utf8Data);
					}
	            }
			}*/
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });


    connection.on('close', function(reasonCode, connectionID) {
    	for(var userId in activeUsersList) {

			if(connection.userID !== userId) {

				//tell every user, that a user have signed out
				activeUsersList[userId].sendUTF(JSON.stringify({
					messageType: 'userSignedOut',
					userId: connection.userID
				}));

			}
		}
		delete activeUsersList[connection.userID];
		console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');

    });
});
