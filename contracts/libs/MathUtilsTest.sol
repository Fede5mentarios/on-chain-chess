pragma solidity 0.5.10;

import "./MathUtils.sol";
contract MathUtilsTest {
  // This returns the absolute value of an integer
  function abs(int256 _value) public pure returns (uint256) {
    return MathUtils.abs(_value);
  }
}
