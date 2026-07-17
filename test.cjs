const isDev = false; async function test() { if (isDev) { await import('non_existent_module'); } } test().catch(console.error);
