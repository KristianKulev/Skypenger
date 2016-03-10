"use strict";
// Initialize everything when the window finishes loading
window.addEventListener("load", function(event) {
	var skypenger = new Skypenger();
	skypenger.init();
});


function Skypenger() {
	this.socket = null;
	this.url = "http://starkey.int.devsmm.com/skypenger/server/ws_server.js";
	this.statusDisplay = document.getElementById('connection-status');
	this.signOutButton = document.getElementById('sign-out-button');
	this.sendButton = document.getElementById('send-button');
	this.message = document.getElementById('message');
	this.messagesList = document.getElementById('messages-list');

	this.singInButton = document.getElementById('sign-in-button');
	this.userID = document.getElementById('messenger-id');

	this.signInBox = document.getElementById('sign-in-box');
	this.chatBox = document.getElementById('chat-box');
	this.signInErrorMessage = document.getElementById('sign-in-error-msg');

	this.userIsTyping = document.getElementById('user-is-typing');
	this.activeUsersList = document.getElementById('active-users-list');

	this.signedInContent = document.getElementById('signed-in-content');
	this.signedInUserInfo = document.getElementById('signed-user-info');

	this.chatInfo = document.getElementById('chat-info');

}

Skypenger.prototype.enterChat = function(shouldEnterChat) {
	if(shouldEnterChat) {
		this.signInBox.className = 'display-none';
		this.signedInContent.className = '';
	} else {
		this.signInBox.className = '';
		this.signedInContent.className = 'display-none';
	}
}

Skypenger.prototype.init = function() {
	var _this = this;



	this.singInButton.addEventListener("click", function(event) {

		if(!_this.userID.value) {
			_this.signInErrorMessage.className = '';
			return;
		}
		_this.enterChat(true);

		_this.chatBox.className = '';
		_this.singInButton.disabled = true;
		_this.socket = new WebSocket(_this.url, "http");

		_this.socket.addEventListener("open", function(e) {
			_this.signOutButton.disabled = false;
			_this.sendButton.disabled = false;

			_this.socket.send(JSON.stringify({
				messageType: 'signUserIn',
				userID: _this.userID.value
			}));

			_this.statusDisplay.innerHTML = "Signed In";
			_this.signedInUserInfo.innerHTML = '<img class="user-pic" src="images/default_user_pic.png">' +
				'<div id="signed-user-info-inner-text"><div id="user-name">' + _this.userID.value + '</div><div>Online</div></div>';

		});

		// Handle messages sent by the server.
		_this.socket.addEventListener('message', function(e) {

			var parsedData = JSON.parse(e.data);

			var message = parsedData.message;

			var user = parsedData.userID;

			_this.displayNotifications(parsedData);

		});

		// Display any errors that occur
		_this.socket.addEventListener("error", function(error) {
			console.log('WebSocket Error: ' + error);
		});

		_this.socket.addEventListener("close", function(event) {
			_this.singInButton.disabled = false;
			_this.statusDisplay.innerHTML = "Signed Out";

			//clear avtiveUsersList
			_this.activeUsersList.innerHTML = '';
		});

	});

	// Close the connection when the Disconnect button is clicked
	this.signOutButton.addEventListener("click", function(event) {

		_this.signOutButton.disabled = true;
		_this.sendButton.disabled = true;
		_this.message.innerHTML = "";
		_this.socket.close(1000, _this.userID.value);
		_this.enterChat(false);
	});

	this.activeUsersList.addEventListener('click', function(e) {
		event.preventDefault();

		var currentTarget = e.target.closest('li') ? e.target.closest('li').id : null;


		if(!currentTarget) return;

		if(_this.conversationTargetId !== currentTarget) {

			_this.socket.send(JSON.stringify({
				userID: _this.userID.value,
				conversationTargetId: _this.conversationTargetId,
				messageType: 'storeChatData',
				messageAsHTML: _this.messagesList.innerHTML
			}));

			//clear the messages
			_this.messagesList.innerHTML = '';

			//set the new conversation target
			_this.conversationTargetId = currentTarget;

			//display the chat info corresponding to the new chat target
			_this.chatInfo.innerHTML = '<img class="user-pic" src="images/default_user_pic.png">' +
				'<div id="signed-user-info-inner-text"><div id="user-name">' + _this.conversationTargetId + '</div></div>';



			_this.socket.send(JSON.stringify({
				userID: _this.userID.value,
				conversationTargetId: _this.conversationTargetId,
				messageType: 'loadStoredChat'
			}));

			_this.displayAlertForNewMessage(_this.conversationTargetId, 'hide');
		}


	});

	// Send message to the server when the Send button is clicked
	this.sendButton.addEventListener("click", function(event) {

		event.preventDefault();

		_this.displayNotifications({message: _this.message.value, userID: _this.userID.value, messageType: 'newSentMessage'});

		var message = JSON.stringify({
			message: _this.message.value,
			userID: _this.userID.value,
			messageType: 'newReceivedMessage',
			conversationTargetId: _this.conversationTargetId
		});

		_this.socket.send(message);

		//clear the message area
		_this.message.value = "";

		_this.userIsCurrentlyTyping = false;
	});

	this.message.addEventListener("input", function(event) {

		event.preventDefault();

		if(_this.userIsCurrentlyTyping) return;


		_this.socket.send(JSON.stringify({
			message: '',
			userID: _this.userID.value,
			messageType: 'startedTyping',
			conversationTargetId: _this.conversationTargetId
		}));

		_this.userIsCurrentlyTyping = true;
	});

	this.message.addEventListener("blur", function(event) {

		event.preventDefault();

		if(_this.message.value === '') {
			_this.socket.send(JSON.stringify({
				message: '',
				userID: _this.userID.value,
				messageType: 'stopedTyping',
				conversationTargetId: _this.conversationTargetId
			}));
			_this.userIsCurrentlyTyping = false;
		}

	});

	//close socket, on page reload
	window.addEventListener('beforeunload', function(){
		_this.socket.close(1000, _this.userID.value);
	}, false);
};

Skypenger.prototype.displayNotifications = function(messageData) {

	//buid and append the new message

	switch(messageData.messageType) {
		case 'newReceivedMessage':

			var newMessage = '<li class="received"><span>' + messageData.userID + ' say\'s:</span>' + messageData.message + '</li>';

			if(this.conversationTargetId === messageData.userID) {
				this.messagesList.innerHTML += newMessage;
			} else {
				console.log(messageData)
				this.displayAlertForNewMessage(messageData.userID, 'show');

				this.socket.send(JSON.stringify({
					userID: messageData.conversationTargetId,
					conversationTargetId: messageData.userID,
					messageType: 'storeAdditionalChatData',
					messageAsHTML: newMessage
				}));
			}

			this.userIsTyping.innerHTML = '';

			break;
		case 'newSentMessage':
			this.messagesList.innerHTML += '<li class="sent"><span>You said:</span>' + this.message.value + ' </li>';
			break;
		case 'startedTyping':
			this.userIsTyping.innerHTML = '<div class="typing">' + messageData.userID + ' is typing...</div>';
			break;
		case 'stopedTyping':
			this.userIsTyping.innerHTML = '';
			break;








		case 'activeUsersList':
			for(var i = 0; i < messageData.activeUsersList.length; i++) {
				this.activeUsersList.innerHTML += '<li id="' + messageData.activeUsersList[i] +
				'"><img class="user-pic" src="images/default_user_pic.png"><span class="chat-name">' +
				messageData.activeUsersList[i] + '</span><span class="unread-message">Message</span></li>';
			}
			break;
		case 'newSignedUser':
			this.activeUsersList.innerHTML += '<li id="' + messageData.newSignedUserId +
			'"><img class="user-pic" src="images/default_user_pic.png"><span class="chat-name">' +
			messageData.newSignedUserId + '</span><span class="unread-message">Message</span></li>';
			break;
		case 'userSignedOut':

			var elementToRemove = document.getElementById(messageData.userId);

			this.activeUsersList.removeChild(elementToRemove);
			break;
		case 'storedChat':
			if(messageData.storedChat) {
				this.messagesList.innerHTML = messageData.storedChat;
			}
			break;
	}

	//scroll view to the new message
	this.messagesList.scrollTop = this.messagesList.scrollHeight;

};

Skypenger.prototype.displayAlertForNewMessage = function(messageFromUserID, actionForAlert) {
	var displayForElement = document.querySelector('#' + messageFromUserID + ' span.unread-message');

	if(actionForAlert === 'show') {
		displayForElement.classList.add('active');
	} else {
		displayForElement.classList.remove('active');
	}
}