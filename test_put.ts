async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/orders/9xn4qsqi8/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' })
    });
    const text = await res.text();
    console.log("Response:", text.substring(0, 200));
  } catch (e) {
    console.error(e);
  }
}
test();
