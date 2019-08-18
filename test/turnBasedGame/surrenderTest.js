/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { assertRevert, assertEvent, assertGame } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: surrender()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: the player who wants to surrender should be part of the game', function() {
      describe('GIVEN an existing started game', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 10000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 10000 });
        });
        it('WHEN calling surrender with an address not related to the game, THEN it should revert', function() {
          return assertRevert(
            turnBasedGame.surrender(gameId, { from: player3 }),
            'sender is not a player'
          );
        });
      });
    });

    const testPlayerSurrender = function({ surrendered, winner }) {
      return describe('RULE: should be possible to surrender', function() {
        describe('GIVEN an existing started game', function() {
          let gameId;
          before(async function() {
            gameId = assertEvent.NewGameStarted(
              await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 10000 })
            );
            await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 10000 });
          });

          describe(`WHEN surrender as player ${surrendered}`, function() {
            let tx;
            before(async function() {
              tx = await turnBasedGame.surrender(gameId, { from: accounts[surrendered] });
            });
            it('THEN an GameEnded is emitted whith the gameId', function() {
              assertEvent.GameEnded(tx, { gameId });
            });
            it(`AND the game has declared player ${winner} as winner`, function() {
              return assertGame(turnBasedGame, gameId, { winner: accounts[winner] });
            });
            it('AND has assigned pot to the winner', function() {
              const expected =
                winner === 2
                  ? { player2Winnings: 20000, player1Winnings: 0, pot: 0 }
                  : { player1Winnings: 20000, player2Winnings: 0, pot: 0 };
              return assertGame(turnBasedGame, gameId, expected);
            });
            it('AND has been ended', async function() {
              return assertGame(turnBasedGame, gameId, { ended: true, timeoutState: 0 });
            });
            it('AND should throw an exception when surrendering the same game', function() {
              return assertRevert(
                turnBasedGame.surrender(gameId, { from: accounts[winner] }),
                'The game already ended'
              );
            });
          });
        });
      });
    };

    testPlayerSurrender({ surrendered: 1, winner: 2 });

    testPlayerSurrender({ surrendered: 2, winner: 1 });
  });
});
