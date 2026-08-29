# CASEMOVE

*Casemove is an open-source desktop application that helps you easily move items out of and into Storage Units in Counter-Strike 2. The app utilizes the [Steam-user](https://github.com/DoctorMcKay/node-steam-user) & [Global Offensive](https://github.com/DoctorMcKay/node-globaloffensive) libraries to establish a connection with Steam and interact with the CS2 game coordinator.* 

> User guides and FAQ: [English](README-EN.md) · [Русский](README-RU.md).  

## COMMON QUESTIONS
#### Can I be VAC banned?

No.
The app doesn’t interact with your CS2 game client. It doesn’t inject any code into the game. You don’t even need to have the game installed for the app to run. All the app does is connect to Steam and emulate a CS2 connection.

Furthermore, the libraries [Steam-user](https://github.com/DoctorMcKay/node-steam-user) & [Global Offensive](https://github.com/DoctorMcKay/node-globaloffensive) have been used by thousands of people, and this app is merely a cosmetic rendition of these libraries.

#### Does Casemove store any of my information?

No, Casemove doesn’t store any information on your computer, except for when you ask it to remember your refresh token. As of Casemove 2.3.3, Casemove no longer stores your password when you login. The refresh token is stored safely using [safeStore](https://www.electronjs.org/docs/latest/api/safe-storage). Casemove doesn’t send any information to anyone outside of Steam.

#### Why can't I just log in using the Steam Web authentication?

In order to move items in and out of Storage Units, the app needs to have an active connection with the CS2 game coordinator. This is not possible when using the web authentication method. However, take a look at the question below. 

#### Where can I read more about the safety?

Casemove is comparable to the software "Archi Steam Farm" and since Archi has made a terrific wiki on this issue, I'd refer over this wiki for further [reading](https://github.com/JustArchiNET/ArchiSteamFarm/wiki/FAQ#security--privacy--vac--bans--tos)

As with anything, It's important to know that the using this software is distributed "as is" and without any warranty. 

----
## Built using
- Node version 14.18.2
- React Electron Boilerplate
- Tailwind v2
----

## Author

Casemove was created by Nombers.

- Steam: https://steamcommunity.com/id/realNombers/
- Reddit: https://www.reddit.com/user/nubbiners
- Discord: Nombers#1046
----

## How to build

The main instructions on how to build the application from source be found using the [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) and it's [docs](https://electron-react-boilerplate.js.org/docs/building). 
I've built the app using [NVM](https://github.com/nvm-sh/nvm) with node version 14.18.2. 


----

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License  along with this program.  If not, see http://www.gnu.org/licenses/.


<!--- Frycus will never know this is here ---> 
