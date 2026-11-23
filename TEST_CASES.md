# Test plan – Thompson's Construction

Run each expression by building the NFA, then enter each test string in the string tester.

| # | Regular expression | Test string | Expected |
|---|---|---|---|
| 1 | `a` | `a` | Accept |
| 2 | `a` | `b` | Reject |
| 3 | `ab` | `ab` | Accept |
| 4 | `ab` | `a` | Reject |
| 5 | `a|b` | `a` | Accept |
| 6 | `a|b` | `b` | Accept |
| 7 | `a|b` | `ab` | Reject |
| 8 | `a*` | empty string | Accept |
| 9 | `a*` | `aaaa` | Accept |
| 10 | `a*` | `b` | Reject |
| 11 | `(a|b)*abb` | `abb` | Accept |
| 12 | `(a|b)*abb` | `aabb` | Accept |
| 13 | `(a|b)*abb` | `abab` | Reject |
| 14 | `a?` | empty string | Accept |
| 15 | `a?` | `a` | Accept |
| 16 | `a+` | `aaa` | Accept |
| 17 | `a+` | empty string | Reject |
| 18 | `ε` | empty string | Accept |

## Evidence to capture for the report
- Screenshot of the input expression and generated NFA.
- Screenshot of the transition table.
- Screenshot showing construction steps.
- Screenshot of at least one accepted string and one rejected string.
- Screenshot of an invalid expression and its validation message.

Record actual results, browser, date, and any issues found. Do not claim a test passed until you have run it.
