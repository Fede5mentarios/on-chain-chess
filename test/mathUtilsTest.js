/** global describe, it, beforeEach */
const MathUtilsTest = artifacts.require('../../contracts/libs/MathUtilsTest.sol');
const { expect } = require('./helpers/assertHelper');

contract('Math Utils:', function() {
  describe('FEATURE: abs()', function() {
    let mathUtils;
    before(async function() {
      mathUtils = await MathUtilsTest.new();
    });

    describe('RULE: returns the absolute value of an integer', function() {
      describe('WHEN calling abs with a positive value', function() {
        let result;
        before(async function() {
          result = await mathUtils.abs('10');
        });
        it('THEN the value should be the same', async function() {
          expect(result).to.eq.BN(10);
        });
      });
      describe('WHEN calling abs with a negative value', function() {
        let result;
        before(async function() {
          result = await mathUtils.abs('-1210');
        });
        it('THEN the value should be the same', async function() {
          expect(result).to.eq.BN(1210);
        });
      });
    });
  });
});
