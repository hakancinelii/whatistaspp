
const customerPhone = '0542 551 88 07';
let cleanPhone = customerPhone.replace(/\D/g, '');
console.log('Original:', customerPhone);
console.log('Digits only:', cleanPhone);
if (cleanPhone.length >= 10) {
    if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
    else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;
}
console.log('Result:', cleanPhone);

const cp2 = '905425518807';
let cl2 = cp2.replace(/\D/g, '');
if (cl2.length >= 10) {
    if (cl2.startsWith('0')) cl2 = '90' + cl2.substring(1);
    else if (cl2.startsWith('5') && cl2.length === 10) cl2 = '90' + cl2;
}
console.log('Original 2:', cp2);
console.log('Result 2:', cl2);
