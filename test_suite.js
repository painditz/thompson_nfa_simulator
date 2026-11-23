/**
 * Automated Test Suite for Thompson's Construction NFA Simulator
 * Verifies all standard and edge-case test vectors against the Thompson NFA engine.
 */

const engine = require('./app.js');

const testCases = [
  { id: 1, re: 'a', str: 'a', expected: true, desc: 'Single literal exact match' },
  { id: 2, re: 'a', str: 'b', expected: false, desc: 'Single literal mismatch' },
  { id: 3, re: 'ab', str: 'ab', expected: true, desc: 'Simple concatenation match' },
  { id: 4, re: 'ab', str: 'a', expected: false, desc: 'Incomplete concatenation' },
  { id: 5, re: 'a|b', str: 'a', expected: true, desc: 'Union left branch match' },
  { id: 6, re: 'a|b', str: 'b', expected: true, desc: 'Union right branch match' },
  { id: 7, re: 'a|b', str: 'ab', expected: false, desc: 'Union rejection of sequence' },
  { id: 8, re: 'a*', str: '', expected: true, desc: 'Kleene star zero repetitions (empty string)' },
  { id: 9, re: 'a*', str: 'aaaa', expected: true, desc: 'Kleene star multiple repetitions' },
  { id: 10, re: 'a*', str: 'b', expected: false, desc: 'Kleene star mismatch' },
  { id: 11, re: '(a|b)*abb', str: 'abb', expected: true, desc: 'Standard textbook regex minimal match' },
  { id: 12, re: '(a|b)*abb', str: 'aabb', expected: true, desc: 'Standard textbook regex prefix match' },
  { id: 13, re: '(a|b)*abb', str: 'abab', expected: false, desc: 'Standard textbook regex negative test' },
  { id: 14, re: 'a?', str: '', expected: true, desc: 'Optional operator zero instances' },
  { id: 15, re: 'a?', str: 'a', expected: true, desc: 'Optional operator one instance' },
  { id: 16, re: 'a+', str: 'aaa', expected: true, desc: 'Positive closure multiple repetitions' },
  { id: 17, re: 'a+', str: '', expected: false, desc: 'Positive closure zero repetitions rejection' },
  { id: 18, re: 'ε', str: '', expected: true, desc: 'Explicit epsilon match with empty string' }
];

console.log('========================================================================');
console.log('       RUNNING AUTOMATED TEST SUITE: THOMPSON NFA SIMULATOR            ');
console.log('========================================================================\n');

let passedCount = 0;
let failedCount = 0;

for (const t of testCases) {
  try {
    const tokens = engine.addConcat(engine.tokenizeRegex(t.re));
    const postfix = engine.toPostfix(tokens);
    const nfa = engine.thompson(postfix);
    const result = engine.accepts(t.str, nfa);
    const pass = result === t.expected;

    if (pass) {
      passedCount++;
      console.log(`[PASS] Case #${t.id.toString().padStart(2, '0')}: RE="${t.re}" String="${t.str}" -> ${result ? 'ACCEPT' : 'REJECT'} (${t.desc})`);
    } else {
      failedCount++;
      console.error(`[FAIL] Case #${t.id.toString().padStart(2, '0')}: RE="${t.re}" String="${t.str}" -> Got: ${result}, Expected: ${t.expected} (${t.desc})`);
    }
  } catch (err) {
    failedCount++;
    console.error(`[ERROR] Case #${t.id}: ${err.message}`);
  }
}

// Error handling validation tests
const errorCases = [
  { id: 'E1', re: '', errorSubstring: 'Enter a regular expression first' },
  { id: 'E2', re: '(a|b', errorSubstring: 'Mismatched parentheses' },
  { id: 'E3', re: 'a|', errorSubstring: 'Union needs two operands' },
  { id: 'E4', re: '*', errorSubstring: 'Operator * has no operand' },
  { id: 'E5', re: 'a#b', errorSubstring: 'Unsupported character' }
];

console.log('\n--- ERROR BOUNDARY VALIDATION ---');
for (const ec of errorCases) {
  try {
    const tokens = engine.addConcat(engine.tokenizeRegex(ec.re));
    const postfix = engine.toPostfix(tokens);
    engine.thompson(postfix);
    failedCount++;
    console.error(`[FAIL] Error Case ${ec.id}: Should have failed on "${ec.re}"`);
  } catch (err) {
    if (err.message.includes(ec.errorSubstring)) {
      passedCount++;
      console.log(`[PASS] Error Case ${ec.id}: Properly caught "${err.message}"`);
    } else {
      failedCount++;
      console.error(`[FAIL] Error Case ${ec.id}: Expected error containing "${ec.errorSubstring}", got "${err.message}"`);
    }
  }
}

console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed, Total: ${testCases.length + errorCases.length}`);
console.log('========================================================================');

if (failedCount > 0) {
  process.exit(1);
}
