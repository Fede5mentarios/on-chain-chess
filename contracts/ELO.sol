pragma solidity 0.5.10;

import "./libs/MathUtils.sol";
/**
 * Simple ELO score rating system based on
 * https://en.wikipedia.org/wiki/Elo_rating_system#Mathematical_details
 */
library ELO {

  struct Scores {
    mapping(address => uint) scores;
  }

  /**
    * Records a game result for a game between two players.
    * Winner can be 0 to record a draw
    */
  function recordResult(Scores storage self, address player1, address player2, address winner) public {
    // Get current scores
    uint scoreA = getScore(self, player1);
    uint scoreB = getScore(self, player2);

    // Calculate result for player A
    int resultA = 1; // 0 = lose, 1 = draw, 2 = win
    if (winner == player1) {
      resultA = 2;
    } else if (winner == player2) {
      resultA = 0;
    }

    // Calculate new score
    (int changeA, int changeB) = getScoreChange(int(scoreA) - int(scoreB), resultA);
    setScore(self, player1, uint(int(scoreA) + changeA));
    setScore(self, player2, uint(int(scoreB) + changeB));
  }

  /**
    * Table based expectation formula
    * E = 1 / ( 1 + 10**((difference)/400))
    * Table calculated based on inverse: difference = (400*log(1/E-1))/(log(10))
    * scoreChange = Round( K * (result - E) )
    * K = 20
    * Because curve is mirrored around 0, uses only one table for positive side
    * Returns (scoreChangeA, scoreChangeB)
    */
  function getScoreChange(int difference, int resultA) public pure returns (int, int) {
    bool reverse = (difference > 0); // note if difference was positive
    uint diff = MathUtils.abs(difference); // take absolute to lookup in positive table
    // Score change lookup table
    int scoreChange = 10;
    if (diff > 636) scoreChange = 20;
    else if (diff > 436) scoreChange = 19;
    else if (diff > 338) scoreChange = 18;
    else if (diff > 269) scoreChange = 17;
    else if (diff > 214) scoreChange = 16;
    else if (diff > 168) scoreChange = 15;
    else if (diff > 126) scoreChange = 14;
    else if (diff > 88) scoreChange = 13;
    else if (diff > 52) scoreChange = 12;
    else if (diff > 17) scoreChange = 11;
    // Depending on result (win/draw/lose), calculate score changes
    if (resultA == 2) {
      return ((reverse ? 20-scoreChange : scoreChange ), (reverse ? -scoreChange : -(20-scoreChange)));
    }
    else if (resultA == 1) {
      return ((reverse ? 10-scoreChange : scoreChange-10 ), (reverse ? -(10-scoreChange) : -(scoreChange-10)));
    }
    else {
      return ((reverse ? scoreChange - 20 : -scoreChange ), (reverse ? scoreChange : -(scoreChange-20)));
    }
  }

  /**
    * Get current score for player
    */
  function getScore(Scores storage self, address player) public view returns (uint) {
    if (self.scores[player] <= 100) {
      return 100;
    }
    return self.scores[player];
  }

  /**
    * Set score for player
    */
  function setScore(Scores storage self, address _player, uint _score) public {
    if (_score <= 100) {
      self.scores[_player] = 100;
    } else {
      self.scores[_player] = _score;
    }
  }
}
