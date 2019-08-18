pragma solidity 0.5.10;

library MathUtils {
  // This returns the absolute value of an integer
  function abs(int256 value) public pure returns (uint256) {
    if (value >= 0) return uint256(value);
    else return uint256(-1 * value);
  }
}
