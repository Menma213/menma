Note that the event command will be blocked by this until completion: 
embed: To begin interacting with the event, please finish the Preview. https://shinobirpg.online/story
To check if user has completed the event preview, check akatsukievent.json under data for their user id. 

All event commands are blocked before this. 
The event summon command will have these:
Guarenteed: 1x Akatsuki Token per summon, 10x per 10 summons.
random chance:
1k exp
500 exp
10k exp
10 ramen
50 ramen
100 ramen
OMEGA RARE 500 ramen
10000 Money
100k money
1m money
5m money
10m money
Very rare: Akatsuki Profile Theme
GIGA RARE: 50m money
7 NEw jutsus
Izanami: Ultimate jutsu of this entire event, LOWEST CHANCE TO GET THIS.
Susanoo (Uchiha only)
Amaterasu: Infinite Flames (Uchiha Only)
Tsukuyomi 
Almighty Push
Praise Jashin
Kamui (rogue, Akatsuki only)

we also need a event shop command:
This shop basically contains all the obtainable jutsu from the event but in exchange for Akatsuki Token
All the jutsu +
Akatsuki Profile theme.
Make them fairly expensive. 


Things we need to do bruh in like 6 hours:
The ads are not ready, they'll take more time.
The event needs to be ready asap. 
I'm scraping the CardMinigame for now as i just couldn't finish it. 
The event:
/event summon
as usual
/event story
This is where the new things are at. So uh story ends with a mangekyo sharingan spinning at us so we'll continue from here. 
User webhook: Oh god. What have i done to deserve this? Where am i? 
Add continue buttons to every webhook message
Zoro: Oi! When you were retrieving the scroll you were followed by 2 men in black! You have no senses!
User webhook: Zoro? You're here too?
Zoro: I had to co-operate. He used a strange mind technique. 
User: it's called a genjutsu. We need to get out of here. 
Zoro: I can break these chains with ease, but it'll only end up worse for us. There's bunch of guards outside.
User: where are your swords?
Zoro: They took em, bastards. Or i wouldnt sit here like a coward.
User: I have enough energy to um maybe kill a guard or two.
Zoro: I don't know how it's gonna help but here, take this an old dying man gave it to me. 
<Obtained 1x Pocket Watch>
User: a watch? I aint Sure how this is gonna work. Nothings gonna happen if we sit here all day! 
Zoro: Alright. 
<Zoro breaks all the chains using Conquerors haki>
Zoro: Let's go!
User: Careful, do not yell!
Guard#1: THEY BROKE THROUGH. EVERYONE ASSEMBLE!
Zoro: Well..Shit.
User: Alright...Watch this.
<User vs 100 Guards Starts>
image for guards: https://i.postimg.cc/MKdPX766/image.png
So this fight is still handled by runbattle but There's only one option for user: Energy Blast. (already created in jutsus.json)
The enemy guards have 100 hp, so they're getting one shot.
User: Hah! Take that. Although..that took all my energy. 
Zoro: Let's find my swords!
*They look around*
They find a room that is covered in ice.
User: That is hella Fishy. 
Zoro: This is where my swords are
User: how do you know?
**Zoro barges in**
Zoro: There they are!
**Zoro picks up his swords**
User: Oof! Thank god. Now let's get out of here.
**As they are about to walk out...**
User: Great..nothing new here. Your regular boring plot twist.
Zoro: I feel the presence again, its the Genjutsu guy.
User: There he is...
Itachi: You broke out? How annoying.
Zoro: I will crush your skull!
User: What do you want from me? why have you been following me?
Itachi: I needed your blood. Now, i have it. You can die.
**Itachi disappears** But the rest of the akatsuki members appear
Zoro: Tch. I'm done. ***ENMA***
**Zoro readies a powerful attack to strike a cloaked akatsuki figure but..**
User: Zoro, watch out!
**Zoro is hit by a really big ice shard! He is bleeding**
User looks up to see who did it and There's another fall falling right at User.
User: So this is how it ends...
<1x Pocket Watch used>
**A Strange Noise Echoes**: ***REPLAY***
Zoro: I feel the presence again, its the Genjutsu guy.
User: H-Huh...
Itachi: You broke out? How annoying.
Zoro: I will crush your skull! 
User: Zoro! whatever you do, Do not attack! 
Zoro: Huh? 
User: Listen to me, please! the pocket watch is a mythical weapon, its reacting to the situation!
Zoro: Then what do you want me to do?
User: I-Idon't know. 
**Mysterious Voice appears**: take this webhook from scroll.js the same webhook says
"Poor Soul. I Shall guide you."
<obtained 1x card **Roronoa Zoro**>
"Young'un. I request thou to equip this card"
User: Huh?
"Please use `/switchcard: Roronoa Zoro` and i shall guide you."

Bot: Event introduction complete! You can now play as Zoro. After switching card to zoro, you can use /event fight and fight your way to Itachi! It's not that easy though! You must level him up using /cardlevelup and slowly unlock his moves using /cardawaken. 
/cardlevelup: each level up costs 200k RYO
/cardawaken: /event fight drops 1 Card Essence per floor. There's 100 floors.
The card part for us though is that we need to code it all, xd
100 floors is veryyy annoying but dw!
Note that you play as Zoro only!
Zoro image: https://i.pinimg.com/736x/28/95/36/289536f9297400c9b08101dec6b9ec08.jpg
So how are we making 100 floors?
There's gonna be 10 npcs, and 10 tiers, you get the idea. Every ten floors, up a tier.
npc1: Sasori
npc2: Hidan
npc3: Kabuto
npc4: Konan
npc5: Kakuzu
npc6: Kisame
npc7: Sasuke Uchiha
npc8: Jugo 
npc9: Suigetsu
npc10: Obito Uchiha

yeah, 10 tiers for them, each tier multiply their base stats by 5x They are immune to all status effects(check otsutsuki.js)
Final Boss: Itachi Uchiha
lore: 
Zoro: You can run, but you CANT HIDE!
Itachi: Pest.
User: It's over now!
Fight begins!
Itachi is a literal raid boss. He has izanami and all one tap jutsu. 
the thing about this whole event is that players are forced to re imagine their decks and all. So we need to make it so that /cardawaken each one costs 20 card Essence. Which means 5 awakenings, 5 jutsu for Zoro. 
YOu need to understand that user PLAYS as zoro so like, normally we do runbattle user but its zoro this time. Zoro starts with attack called "Sword Slash" and every time the user dies, they must restart from 1st floor, this forces users to max out Zoro build before heading to battle. Like i said 200k per level for Zoro and his stats must be good enough to beat the npcs, we must plan all of it.
Card Essence is a one time drop per npc per floor
We need to limit the levels zoro can gain like per awakening, there's total 5 awakenings so yeah.
NOW ASK ME QUESTIONS.
Leave the npc images blank, ill fill them

I specifically want you to ask all the questions because the zoro floors part will create alot of doubts and even help cover up the mistakes and points ive missed out. 

