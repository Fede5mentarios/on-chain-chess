/** global describe, it, beforeEach */
const { getContracts, CONSTANTS } = require('./helpers/testHelper');
const { expect, assertRevert, assertEvent } = require('./helpers/assertHelper');

contract('ELO:', function(accounts) {
  let eloContract;
  before(async function() {
    [, , eloContract] = await getContracts();
  });

  describe('RULE: the score of any address has a a minimun', function() {
    describe('WHEN calling getScore for new address', function() {
      it('THEN the score is 100', function() {
        return expect(eloContract.getScore(accounts[1])).to.eventually.be.eq.BN(100);
      });
    });
    describe('WHEN calling setScore for new address with a score lower than the min', function() {
      before(function() {
        return eloContract.setScore(accounts[2], 70);
      });
      it('THEN the saved score is 100', function() {
        return expect(eloContract.getScore(accounts[2])).to.eventually.be.eq.BN(100);
      });
    });
  });

  
});
