pragma solidity 0.5.10;

/**
 * Contract to test ELO implementation
 */

import "./ELO.sol";

contract EloTest {
  using ELO for ELO.Scores;
  ELO.Scores eloScores;

  function recordResult(address _player1, address _player2, address _winner) public {
    eloScores.recordResult(_player1, _player2, _winner);
  }

  function getScoreChange(int _difference, int _resultA) public pure returns (int, int) {
    return ELO.getScoreChange(_difference, _resultA);
  }

  function getScore(address _player) public view returns (uint) {
    return eloScores.getScore(_player);
  }

  function setScore(address _player, uint _score) public {
    eloScores.setScore(_player, _score);
  }
}
