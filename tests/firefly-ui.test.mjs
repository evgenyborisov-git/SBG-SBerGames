import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
rmSync('.sites-runtime/ui-test-build',{recursive:true,force:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','components/firefly-game.tsx','components/pet-evolution.tsx','components/first-steps.tsx','components/next-friend.tsx','components/island-screen.tsx','components/collection-screen.tsx','components/game-navigation.tsx','components/pilot-guide.tsx','--rootDir','.','--outDir','.sites-runtime/ui-test-build','--module','commonjs','--target','es2022','--jsx','react-jsx','--esModuleInterop','--skipLibCheck','--types','node']);
writeFileSync('.sites-runtime/ui-test-build/package.json','{"type":"commonjs"}');
const require=createRequire(import.meta.url),{FireflyGame}=require('../.sites-runtime/ui-test-build/components/firefly-game.js'),{PetEvolution}=require('../.sites-runtime/ui-test-build/components/pet-evolution.js'),{initial,transition}=require('../.sites-runtime/ui-test-build/lib/game/rules.js'),{abilities}=require('../.sites-runtime/ui-test-build/lib/game/abilities.js');
test('game UI renders start, attempt limit, saved result and all guardian descriptions without browser storage',()=>{
 const time=Date.UTC(2026,10,16,9);let state=transition(initial(time),'select:luna',time);state.level=3;state.journey.owned.luna={level:3,xp:0,stage:2,collection:['egg','grown','guardian']};
 const render=s=>renderToStaticMarkup(React.createElement(FireflyGame,{state:s,serverTime:time,disabled:false,onStart(){},onFinish(){}}));
 let html=render(state);assert.match(html,/Наградная игра · 7 энергии/);assert.match(html,/Тренировка без награды/);assert.match(html,/0\/3/);
 state.fireflies.attempts=3;html=render(state);assert.match(html,/disabled=""[^>]*><svg[^]*?Наградная игра · 7 энергии/);assert.match(html,/3\/3/);
 state.fireflies.round={id:crypto.randomUUID(),seed:1,petId:'luna',guardian:true,startedAt:time-18000,day:'2026-11-16',settled:true,score:12,reward:{xp:34,coins:4,crystals:4}};html=render(state);assert.match(html,/Поймано 12 из 12/);assert.match(html,/\+34 опыта · \+4 монет · \+4 кристаллов/);
 for(const id of Object.keys(abilities)){
  const s=transition(initial(time),`select:${id}`,time);s.journey.owned[id].stage=2;
  const card=renderToStaticMarkup(React.createElement(PetEvolution,{state:s,disabled:false,onEvolve(){}}));assert.ok(card.includes(abilities[id].title));assert.ok(!card.includes('undefined'));
 }
});

test('first-visit UI hides for existing profiles and shows saved steps plus the collection destination',()=>{
 const {FirstSteps}=require('../.sites-runtime/ui-test-build/components/first-steps.js');
 const props={disabled:false,onPet(){},onPlay(){},onGift(){},onDismiss(){}};
 const render=state=>renderToStaticMarkup(React.createElement(FirstSteps,{...props,state}));
 const t=Date.UTC(2026,10,16,9);let s=transition(initial(t),'select:owl',t);
 let html=render(s);assert.match(html,/Первые минуты вместе/);assert.match(html,/0\/3/);assert.match(html,/Продолжить самостоятельно/);
 s=transition(s,'intro_pet',t);s=transition(s,'play:owl',t);s=transition(s,'daily',t);
 html=render(s);assert.match(html,/Вы уже подружились/);assert.match(html,/3\/3/);assert.match(html,/Посмотреть путь к следующему другу/);
 s=transition(s,'dismiss_intro',t);assert.equal(render(s),'');
 delete s.intro;assert.equal(render(s),'');
});

test('next friend UI explains each server prerequisite and completes at twelve',()=>{
 const {NextFriend}=require('../.sites-runtime/ui-test-build/components/next-friend.js');
 const render=state=>renderToStaticMarkup(React.createElement(NextFriend,{state,onCollection(){}}));
 const t=Date.UTC(2026,10,16,9);let s=transition(initial(t),'select:owl',t);
 let html=render(s);assert.match(html,/Осталось 30/);assert.match(html,/Полученные друзья уровня 2/);
 s.journey.crystals=30;s.journey.owned.owl.level=2;html=render(s);assert.match(html,/Всё готово к новой встрече/);
 for(const id of Object.keys(abilities))s.journey.owned[id]={level:2,xp:0,stage:1,collection:['egg']};
 html=render(s);assert.match(html,/Все 12 друзей дома/);assert.ok(!html.includes('Кристаллы для приглашения'));
});

test('island keeps care primary and onboarding reveals only the next unfinished step',()=>{
 const {IslandScreen}=require('../.sites-runtime/ui-test-build/components/island-screen.js'),{FirstSteps}=require('../.sites-runtime/ui-test-build/components/first-steps.js');
 const t=Date.UTC(2026,10,16,9);let s=transition(initial(t),'select:owl',t);
 const intro=state=>renderToStaticMarkup(React.createElement(FirstSteps,{state,disabled:false,onPet(){},onPlay(){},onGift(){},onDismiss(){}}));
 let html=intro(s);assert.match(html,/Погладить/);assert.ok(!html.includes('Получить подарок'));assert.ok(!html.includes('Поиграйте вместе'));
 s=transition(s,'intro_pet',t);html=intro(s);assert.match(html,/Поиграйте вместе/);assert.ok(!html.includes('Получить подарок'));
 const props={state:s,disabled:false,emotion:{reaction:0,sequence:0,loading:false,failed:false},petLine:'Привет!',onPet(){},onFeed(){},onPlay(){},onQuiet(){},onToday(){},onCollection(){},children:null};
 html=renderToStaticMarkup(React.createElement(IslandScreen,props));assert.match(html,/Твой питомец/);assert.match(html,/Покормить/);assert.match(html,/Поиграть/);
 for(const secondary of ['Поляна светлячков','Задания дня','МАГИЯ ПРЕВРАЩЕНИЯ','Кристаллы для приглашения'])assert.ok(!html.includes(secondary));
});

test('four primary destinations separate games, collection and rewards; collection views preserve all pets',()=>{
 const {GameNavigation}=require('../.sites-runtime/ui-test-build/components/game-navigation.js'),{CollectionScreen}=require('../.sites-runtime/ui-test-build/components/collection-screen.js');
 let html=renderToStaticMarkup(React.createElement(GameNavigation,{active:'games',readyRewards:2,onNavigate(){}}));assert.equal((html.match(/<button/g)||[]).length,4);assert.match(html,/Остров/);assert.match(html,/Игры/);assert.match(html,/Питомцы/);assert.match(html,/Сегодня/);assert.ok(!html.includes('Как играть'));
 const t=Date.UTC(2026,10,16,9),s=transition(initial(t),'select:owl',t),props={state:s,disabled:false,onView(){},onVisit(){},onHome(){},onUnlock(){},onEvolve(){}};
 html=renderToStaticMarkup(React.createElement(CollectionScreen,{...props,view:'friends'}));assert.match(html,/К кому заглянем/);assert.match(html,/Сейчас на острове/);assert.ok(!html.includes('МАГИЯ ПРЕВРАЩЕНИЯ'));
 html=renderToStaticMarkup(React.createElement(CollectionScreen,{...props,view:'atlas'}));assert.equal((html.match(/class="creature-card guardian-card"/g)||[]).length,12);
 html=renderToStaticMarkup(React.createElement(CollectionScreen,{...props,view:'growth'}));assert.match(html,/МАГИЯ ПРЕВРАЩЕНИЯ/);assert.match(html,/Три облика/);
 const {PilotGuide}=require('../.sites-runtime/ui-test-build/components/pilot-guide.js');html=renderToStaticMarkup(React.createElement(PilotGuide));assert.match(html,/Сегодня/);assert.match(html,/Завтра/);assert.match(html,/Закрой мини-приложение/);assert.match(html,/Отзыв/);
});
