const assert = require('assert');
const escapeRegex = require('./escapeRegex');

let str = '.';
let regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'.' not escaped");

str = 'a+';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'+' not escaped");

str = 'a?a';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'?' not escaped");

str = '(a)';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'()' not escaped");

str = 'a{2,3}';
regex = new RegExp(escapeRegex(str));
assert(
  regex.test(str) && !regex.test('aa') && !regex.test('aaa'),
  "'{}' not escaped",
);

str = '[a-c]';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('b'), "'[]' not escaped");

str = '^a';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'^' not escaped");

str = 'a$';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'$' not escaped");

str = 'a*';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test(''), "'*' not escaped");

str = 'a|b';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str) && !regex.test('a'), "'|' not escaped");

str = '-';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str), "'-' not escaped");

str = ',';
regex = new RegExp(escapeRegex(str));
assert(regex.test(str), "',' not escaped");
