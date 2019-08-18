pragma solidity 0.5.10;

contract Debuggable {
  bool private debug;
  modifier debugOnly {
    require(debug, "function only visible in debug mode");
    _;
  }

  constructor (bool _enableDebugging) internal {
    debug = _enableDebugging;
  }
}
