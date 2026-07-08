import { Vibrant } from 'node-vibrant/node';
async function test() {
  const b = Vibrant.from('https://upload.wikimedia.org/wikipedia/en/2/26/Linkin_Park_Meteora_Album_Cover.jpg');
  console.log(Object.keys(b));
  console.log(Object.keys(b.__proto__));
}
test();
