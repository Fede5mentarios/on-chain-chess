/** global describe, it, beforeEach */
const { getContracts, CONSTANTS } = require('../helpers/testHelper');
const { expect, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  describe('FEATURE: closePlayerGame()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: Closing a open game that never started', function() {
      describe('GIVEN an existing game', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 1000 })
          );
        });
        describe('WHEN trying to close it with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.closePlayerGame(gameId, { from: player2 }),
              'sender is not a player'
            );
          });
        });
        describe('BUT WHEN closing the game as the creator', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.closePlayerGame(gameId, { from: player1 });
          });
          it('THEN the Game Closed event is emmited', async function() {
            return assertEvent.GameClosed(tx, { gameId, player: player1 });
          });
          it('AND the game no longer appears as open', function() {
            return expect(turnBasedGame.openGameIds(gameId)).to.eventually.be.equals(
              CONSTANTS.b32EMPTY
            );
          });
          it('AND the game pot is moved to the player 1', async function() {
            const { pot, player1Winnings } = await turnBasedGame.games(gameId);
            expect(pot).to.eq.BN(0);
            expect(player1Winnings).to.eq.BN(1000);
          });
          it('AND the game no longer appears as a game of the player 1', function() {
            return expect(turnBasedGame.getGamesOfPlayer(player1)).to.eventually.not.include(
              gameId
            );
          });
        });
      });
    });

    describe('RULE: closing a game that has started and it is going to end', function() {
      describe('GIVEN an started game that has not ended and it is the head for the player 2 and the last for the player 1', function() {
        let gameId;
        let headGameForP1;
        let secondGameForP1;
        before(async function() {
          [gameId, secondGameForP1, headGameForP1] = (await Promise.all(
            ['alice', 'alice2', 'alice3'].map(name =>
              turnBasedGame.initGame(name, 10, true, { from: player1 })
            )
          )).map(assertEvent.NewGameStarted);
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
        });

        describe('WHEN any player try to close it', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.closePlayerGame(gameId, { from: player1 }),
              'game already started and has not ended yet'
            );
          });
        });

        describe('BUT WHEN trying to close the game as player 2, only after it has ended', function() {
          let tx;
          before(async function() {
            await turnBasedGame.surrender(gameId, { from: player1 });
            tx = await turnBasedGame.closePlayerGame(gameId, { from: player2 });
          });
          it('THEN the Game Closed event is emmited', async function() {
            return assertEvent.GameClosed(tx, { gameId, player: player2 });
          });
          it('AND the game pot is not moved to the player 1', async function() {
            const { pot, player1Winnings } = await turnBasedGame.games(gameId);
            expect(pot).to.eq.BN(0);
            expect(player1Winnings).to.eq.BN(0);
          });
          it('AND the game no longer appears as a game of the player 2', function() {
            return expect(turnBasedGame.getGamesOfPlayer(player2)).to.eventually.not.include(
              gameId
            );
          });
          it('BUT it appears as a game of the player 1', function() {
            return expect(turnBasedGame.getGamesOfPlayer(player1)).to.eventually.include(gameId);
          });
          it.skip('AND it is not possible to close the game again for the player 2', function() {
            return assertRevert(
              turnBasedGame.closePlayerGame(gameId, { from: player2 }),
              'game already close for the player'
            );
          });
        });

        describe('AND WHEN closing the game as the player 1', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.closePlayerGame(gameId, { from: player1 });
          });
          it('THEN the Game Closed event is emmited', async function() {
            return assertEvent.GameClosed(tx, { gameId, player: player1 });
          });
          it('AND the game no longer appears as a game of the player 1', function() {
            return expect(turnBasedGame.getGamesOfPlayer(player1)).to.eventually.not.include(
              gameId
            );
          });
          it('AND the second game continues as the head of the games Id for player 1', async function() {
            return expect(turnBasedGame.gamesOfPlayersHeads(player1)).to.eventually.be.equals(
              headGameForP1
            );
          });
          it('AND the second game is now also the end of the games Id list for pleyer 1', async function() {
            return expect(
              turnBasedGame.getGamesOfPlayer(player1)
            ).to.eventually.have.ordered.members([headGameForP1, secondGameForP1]);
          });
          it.skip('AND it is not possible to close the game again for the player 1', function() {
            return assertRevert(
              turnBasedGame.closePlayerGame(gameId, { from: player1 }),
              'game already close for the player'
            );
          });
        });
      });
    });
  });
});
