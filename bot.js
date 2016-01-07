/////////////////////////////////////////
// Safety: Uncomment everything to use //
/////////////////////////////////////////

// // dependencies
var _ = require('lomath');

// setup mysql
var mysql = require('mysql');

var db_config = {
    host: 'host',
    user: 'user',
    password: 'password',
    database: 'database'
};

var connection;

function handleDisconnect() {
    console.log('1. connecting to db:');
    connection = mysql.createConnection(db_config); // Recreate the connection, since
													// the old one cannot be reused.

    connection.connect(function(err) {              	// The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('2. error when connecting to db:', err);
            setTimeout(handleDisconnect, 1000); // We introduce a delay before attempting to reconnect,
        }                                     	// to avoid a hot loop, and to allow our node script to
    });                                     	// process asynchronous requests in the meantime.
    											// If you're also serving http, display a 503 error.
    connection.on('error', function(err) {
        console.log('3. db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { 	// Connection to the MySQL server is usually
            handleDisconnect();                      	// lost due to either server restart, or a
        } else {                                      	// connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}

handleDisconnect();

// // API as superclass that bot inherits methods from
var API = require(__dirname + '/API.js')

// // The bot object prototype
// // bot extends and inherits methods of API
var bot = function(token, webhookUrl) {
    API.apply(this, arguments);
    // set webhook on construction: override the old webhook
    this.setWebhook(webhookUrl || '');

}

// // set prototype to API
bot.prototype = API.prototype;
// // set constructor back to bot
bot.prototype.constructor = bot;


/**
 * Handles a Telegram Update object sent from the server. Extend this method for your bot.
 * 
 * @category Bot
 * @param {Object} req The incoming HTTP request.
 * @param {Object} res The HTTP response in return.
 * @returns {Promise} promise A promise returned from calling Telegram API method(s) for chaining.
 *
 * @example
 * var bot1 = new bot('yourtokenhere');
 * ...express server setup
 * app.route('/')
 * // robot API as middleware
 * .post(function(req, res) {
 *     bot1.handle(req, res)
 * })
 * // Then bot will handle the incoming Update from you, routed from Telegram!
 * 
 */
bot.prototype.handle = function(req, res) {
//     // the Telegram Update object. Useful shits
    var Update = req.body,
//         // the telegram Message object
        Message = Update.message,
//         // the user who sent it
        user_id = Message.from.id,
//         // id of the chat(room)
        chat_id = Message.chat.id;

//     ////////////////////////
//     // Extend from here:  //
//     ////////////////////////
//     // you may call the methods from API.js, which are all inherited by this bot class
    
//     // echo
	function getState (chat_id, scope, message, callback) {
		var query = connection.query('SELECT id, state from chat_session where chat_id = ?', chat_id);
		var resultCount = 0;

		query.on('error', function(err) {
    		scope.sendMessage(chat_id, "DB Error: " + err);
    	});

		query.on('result', function(rows) {
	   		resultCount++;
	   		if (rows.state == 1) {
	   			var kb = {
					keyboard: [
		         		['yes', 'no']
		     		],
		     		one_time_keyboard: true
			 	};
	   			scope.sendMessage(chat_id, "Would you like to start a game?",undefined, undefined, kb);
	   			var updateQuery = connection.query('UPDATE chat_session set state = 2 WHERE chat_id = ?', chat_id);
	   		}
	   		else if (rows.state == 2 && message === 'yes') {
	   			scope.sendMessage(chat_id, "Great! Try and guess this quote...");
	   			var quoteQuery = connection.query('SELECT * FROM quote ORDER BY rand() LIMIT 1');
	   			

	   			quoteQuery.on('result', function(quoteRows) {
	   				scope.sendMessage(chat_id, "\"" + quoteRows.quote + "\"");
	   				var post = {session_id: rows.id, quote_id: quoteRows.id};
	   				var insertQuery = connection.query('INSERT INTO session_quote SET ?', post);
	   		   		});
	   		
	   			var updateQuery = connection.query('UPDATE chat_session set state = 3 WHERE chat_id = ?', chat_id);


	   		}
	   		else if (rows.state == 2 && message === 'no') {
	   			scope.sendMessage(chat_id, "Cool - to start a new game later, just say 'start'!");
	   			var updateQuery = connection.query('UPDATE chat_session set state = 1 WHERE chat_id = ?', chat_id);
	   		}
	   		else if (rows.state == 3) {
	   			var quoteAnswer = connection.query('SELECT q.movie, q.character FROM quote q INNER JOIN session_quote sq ON (sq.quote_id = q.id) INNER JOIN chat_session cs ON (sq.session_id = cs.id) WHERE  cs.chat_id = ?', chat_id);
	   			quoteAnswer.on('result', function(movieRow) {
	   				if (message.toUpperCase().indexOf(movieRow.movie.toUpperCase()) > -1) {
	   					scope.sendMessage(chat_id, "Correct!");
	   					var deleteQuery = connection.query('DELETE from session_quote WHERE session_id= ?', rows.id);
	   					var kb = {
					keyboard: [
		         		['yes', 'no']
		     		],
		     			one_time_keyboard: true
			 			};
	   					scope.sendMessage(chat_id, "Would you like to start a game?",undefined, undefined, kb);
	   					var updateQuery = connection.query('UPDATE chat_session set state = 2 WHERE chat_id = ?', chat_id);

	   				} else {
	   					scope.sendMessage(chat_id, "Oh.. I'm afraid not.. here is a hint though - the character who said it was " + movieRow.character + "!");
	   					var updateQuery = connection.query('UPDATE chat_session set state = 4 WHERE chat_id = ?', chat_id);
	   				}
	   			});
	   		} else if (rows.state == 4) {
	   			var quoteAnswer = connection.query('SELECT q.movie, q.character FROM quote q INNER JOIN session_quote sq ON (sq.quote_id = q.id) INNER JOIN chat_session cs ON (sq.session_id = cs.id) WHERE  cs.chat_id = ?', chat_id);
	   			quoteAnswer.on('result', function(movieRow) {
	   				if (message.toUpperCase().indexOf(movieRow.movie.toUpperCase()) > -1) {
	   					scope.sendMessage(chat_id, "Correct!");

	   					} else {
	   					scope.sendMessage(chat_id, "Sorry - we were actually looking for " + movieRow.movie + "!");
	   					}
	   					var deleteQuery = connection.query('DELETE from session_quote WHERE session_id = ?', rows.id);
	   				var kb = {
					keyboard: [
		         		['yes', 'no']
		     		],
		     		one_time_keyboard: true
				 	};
	   				scope.sendMessage(chat_id, "Would you like to start a game?",undefined, undefined, kb);
	   				var updateQuery = connection.query('UPDATE chat_session set state = 2 WHERE chat_id = ?', chat_id);
	   				
	   			});
	   		} else {
	   			scope.sendMessage(chat_id, "Ugh, a bug in the game!" + rows.state);
	   		}
		});

		query.on('end', function() {
			if (resultCount < 1) {
				scope.sendMessage(chat_id, "Welcome! To begin a game, type 'start'");
				var post = {chat_id: chat_id, state: 1};
				var insertQuery = connection.query('INSERT INTO chat_session SET ?', post);
			}
    		//scope.sendMessage(chat_id, "DB Error? + " + chat_id);
    	});
    }

	getState(chat_id, this, Message.text.toString(), function(err, result) {
		

		//for (var i = 0; i < result.length; i++) {
 		//	this.sendMessage(chat_id, "db row[" + i + "] "  + result[i].id + ", " + result[i].chat_id + ", " + result[i].state);
		//};
	});

	

}

// export the bot class
module.exports = bot;

// sample keyboard
// var kb = {
//     keyboard: [
//         ['one', 'two'],
//         ['three'],
//         ['four']
//     ],
//     one_time_keyboard: true
// }
