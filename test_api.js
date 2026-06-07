const fetch = require('node-fetch');

(async () => {
    const res = await fetch('https://discordlookup.mesalinc.com/v1/user/crytek_ads').catch(console.error);
    if (res) console.log(await res.text());
})();

