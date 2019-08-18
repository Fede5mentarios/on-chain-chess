const { modules } = require('web3');

const { assert } = require('chai');

const gameStateDisplay = state => {
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const row = [];
    for (let j = 0; j < 16; j++) {
      row.push(('   ' + state[i * 16 + j].toString(10)).slice(-3));
    }
    rows.push(row.join(' '));
  }
  return rows.join('\n');
};

class Plan {
  constructor(count, done) {
    this.done = done;
    this.count = count;
  }

  ok() {
    if (this.count === 0) {
      assert(false, 'Too many assertions called');
    } else {
      this.count--;
    }
    if (this.count === 0) {
      this.done();
    }
  }
}

modules.export = {
  gameStateDisplay,
  Plan
};
