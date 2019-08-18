/** global describe, it, beforeEach */
const { defaultBoard } = require('./helpers/utils');
const { getContracts } = require('./helpers/testHelper');
const assertEvent = require('./helpers/assertHelper');

contract.skip('Chess contract: ', function(accounts) {
  const player1 = accounts[1];
  const testGames = [];
  describe('FEATURE: initGame()', function() {
    let chess;
    beforeEach(async function() {
      [chess] = await getContracts();
    });

    it('RULE: should initialize a game with player1 playing white with 1M Wei', async function() {
      testGames.push(
        assertEvent.GameInitialized(
          await chess.initGame('Alice', true, 10, {
            from: player1,
            gas: 2000000,
            value: 1000000
          }),
          {
            player1Alias: 'Alice',
            player1,
            playerWhite: player1,
            turnTime: 10,
            pot: 2 * 1000000
          }
        )
      );
    });

    it('RULE: should broadcast the initial game state', async function() {
      testGames.push(
        assertEvent.GameStateChanged(
          await chess.initGame('Bob', true, 10, {
            from: player1,
            gas: 2000000
          }),
          defaultBoard
        )
      );
    });

    it('RULE: should initialize a game with player1 playing black', async function() {
      assertEvent.GameInitialized(
        await chess.initGame('Susan', false, 10, {
          from: player1,
          gas: 2000000
        }),
        {
          player1Alias: 'Susan',
          player1,
          playerWhite: 0
        }
      );
    });

    // Test with others TurnBasedGame test
    // it('RULE: should have set game state to not ended', async function() {
    //   assert.isFalse(await chess.isGameEnded(testGames[0]));
    // });

    // it('RULE: should have set gamesOfPlayers', async function() {
    //   assert.isTrue((await chess.getGamesOfPlayer(player1).indexOf(testGames[0])) !== -1);
    //   assert.isTrue((await chess.getGamesOfPlayer(player1).indexOf(testGames[1])) !== -1);
    // });

    // it('RULE: should have the pot of 1M Wei for the first game', async function() {
    //   assert.equal(adjustPot(1000000), chess.games(Number(testGames[0])[7]));
    // });
  });
});
