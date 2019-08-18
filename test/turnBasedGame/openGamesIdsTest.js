/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const { getContracts, CONSTANTS } = require('../helpers/testHelper');
const { expect, assertEvent } = require('../helpers/assertHelper');

describe('Turn Based Game:', function() {
  describe('FEATURE: openGameIds()', function() {
    let turnBasedGame;
    contract('GIVEN two existing games', function(accounts) {
      let game1;
      let game2;
      before(async function() {
        [, turnBasedGame] = await getContracts();
        [game1, game2] = (await Promise.all([
          turnBasedGame.initGame('Alice1', 100, true, { from: accounts[1] }),
          turnBasedGame.initGame('Alice2', 100, true, { from: accounts[1] })
        ])).map(assertEvent.NewGameStarted);
      });
      describe('WHEN joining the game at the tail of the game list', function() {
        before(async function() {
          await turnBasedGame.joinGame(game1, 'Avril', { from: accounts[2] });
        });
        it('THEN the game no longer appears as open', async function() {
          return expect(turnBasedGame.openGameIds(game1)).to.eventually.be.equals(
            CONSTANTS.b32EMPTY
          );
        });
        it('AND the second game continues as the head of the games Id list', async function() {
          return expect(turnBasedGame.head()).to.eventually.be.equals(game2);
        });
        it('AND the second game is now also the end of the games Id list', async function() {
          return expect(turnBasedGame.openGameIds(game2)).to.eventually.be.equals(
            CONSTANTS.b32ENDOFLIST
          );
        });
      });

      describe('AND GIVEN a new game inserted', function() {
        let game3;
        before(async function() {
          game3 = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice3', 100, true, { from: accounts[1] })
          );
        });
        describe('AND WHEN joining the game at the head of the game list', function() {
          before(async function() {
            await turnBasedGame.joinGame(game3, 'Avril', { from: accounts[2] });
          });
          it('THEN the game no longer appears as open', async function() {
            return expect(turnBasedGame.openGameIds(game3)).to.eventually.be.equals(
              CONSTANTS.b32EMPTY
            );
          });
          it('AND the game no longer is is the head of the games Id list', async function() {
            return expect(turnBasedGame.head()).to.eventually.not.be.equals(game3);
          });
          it('AND the first game is the new head of the games Id list', async function() {
            return expect(turnBasedGame.head()).to.eventually.be.equals(game2);
          });
          it('AND the first game continues as the last of the games Id list', async function() {
            return expect(turnBasedGame.openGameIds(game2)).to.eventually.be.equals(
              CONSTANTS.b32ENDOFLIST
            );
          });
        });
      });
    });

    contract('RULE: joining a game without it been the head or the tail', function(accounts) {
      describe('GIVEN an 3 existing games', function() {
        let gamesIds;
        before(async function() {
          [, turnBasedGame] = await getContracts();
          gamesIds = (await Promise.all(
            ['Alice1', 'Alice2', 'Alice3'].map(name =>
              turnBasedGame.initGame(name, 100, true, { from: accounts[1] })
            )
          )).map(assertEvent.NewGameStarted);
        });
        describe('WHEN joining the second one', function() {
          before(async function() {
            await turnBasedGame.joinGame(gamesIds[1], 'Avril', {
              from: accounts[2]
            });
          });
          it('THEN the game no longer appears as open', async function() {
            return expect(turnBasedGame.openGameIds(gamesIds[1])).to.eventually.be.equals(
              CONSTANTS.b32EMPTY
            );
          });
          it('AND the third game continues as the head of the games Id list', async function() {
            return expect(turnBasedGame.head()).to.eventually.be.equals(gamesIds[2]);
          });
          it('AND the first game continues as the end of the games Id list', async function() {
            return expect(turnBasedGame.openGameIds(gamesIds[0])).to.eventually.be.equals(
              CONSTANTS.b32ENDOFLIST
            );
          });
          it('AND the third game is followed by the first game in the Id list', async function() {
            return expect(turnBasedGame.openGameIds(gamesIds[2])).to.eventually.be.equals(
              gamesIds[0]
            );
          });
        });
      });
    });
  });
});
