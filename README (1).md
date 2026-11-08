# Harbor Heat: your own multiplayer server

No installs or accounts needed. The server is a single file with no dependencies.

## Run it on your computer (friends on the same Wi-Fi)
1. Install Node.js 18 or newer from https://nodejs.org (free).
2. Keep these files together in one folder: `server.js`, `harbor-heat-3d.html`, `package.json`.
3. Open a terminal in that folder and run:  `node server.js`
4. It prints two addresses. Open the first one on your computer, and give the
   "Friends on your Wi-Fi" address (like `http://192.168.1.5:8080`) to your friends.
   They open it in their phone or computer browser.
5. Everyone types a nickname and taps **PLAY ONLINE**.
   - Leave **Friends room code** empty to join the public room, or
   - tap **NEW PRIVATE ROOM** and share the code so only your friends join.

## Play over the internet (friends anywhere)
Put these same files on any host that runs Node.js, for example Render, Railway or Fly.io:
- Start command: `node server.js`  (the host sets the PORT for you)
- Open the https address the host gives you. Players connect automatically and
  secure WebSocket (wss) is used for you.
Free plans may sleep when idle, so the first load can take about a minute.

## Good to know
- Up to 16 players per room, as many rooms as you like (each room code is its own room).
- The game page is served by the server, so the server address is filled in automatically.
  The "Own server" box is only needed if you open a downloaded copy of the page from your
  files: type your server address there, for example `192.168.1.5:8080` or `my-game.onrender.com`.
- Health check: open `/health` on the server address to see how many players are online.
- Positions, chat, shots and hits are trusted from each player's device. This is meant for
  friends, not a cheat-proof public server.

## தமிழில் சுருக்கம்
1. Node.js (nodejs.org) install பண்ணுங்க.
2. `server.js`, `harbor-heat-3d.html`, `package.json` மூன்றையும் ஒரே folder-ல் வையுங்க.
3. அந்த folder-ல் terminal திறந்து `node server.js` என்று type பண்ணுங்க.
4. அது காட்டும் "Friends on your Wi-Fi" address-ஐ friends-க்கு கொடுங்க. அவங்க browser-ல் திறந்து
   nickname கொடுத்து PLAY ONLINE அழுத்தினா எல்லாரும் ஒரே game-ல் இருப்பீங்க.
5. Friends மட்டும் வர வேண்டும் என்றால் NEW PRIVATE ROOM அழுத்தி வரும் code-ஐ பகிருங்க.
6. Internet-ல் எல்லாருக்கும் வேண்டுமானால் இதே files-ஐ Render அல்லது Railway போன்ற free host-ல் ஏற்றுங்க.
