import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
rmSync('.sites-runtime/ui-test-build',{recursive:true,force:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','components/firefly-game.tsx','components/pet-evolution.tsx','components/first-steps.tsx','components/next-friend.tsx','--rootDir','.','--outDir','.sites-runtime/ui-test-build','--module','commonjs','--target','es2022','--jsx','react-jsx','--esModuleInterop','--skipLibCheck','--types','node']);
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
