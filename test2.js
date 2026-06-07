(async () => {
    // 156114103033757696 (my discord id or just some random one)
    let res = await fetch('https://api.lanyard.rest/v1/users/156114103033757696').catch(console.error);
    if (res) console.log('Lanyard:', await res.text());
})();
