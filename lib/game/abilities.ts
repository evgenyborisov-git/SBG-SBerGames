import type {PetId} from './pets';
export const abilities:Record<PetId,{title:string;description:string}>={
 chudik:{title:'Тёплое свечение',description:'Светлячок остаётся доступен на 0,3 секунды дольше.'},
 luna:{title:'Лунная лёгкость',description:'Наградная попытка со светлячками стоит 7 энергии вместо 10.'},
 peach:{title:'Искра открытия',description:'Успешный раунд со светлячками даёт ещё 10 опыта.'},
 otter:{title:'Облачный прилив',description:'После успешного раунда возвращает 5 энергии.'},
 owl:{title:'Взгляд рассвета',description:'В мини-игре заранее подсвечивает следующую клетку.'},
 deer:{title:'Цветочное угощение',description:'Кормление восстанавливает до 25 энергии вместо 20.'},
 hedgehog:{title:'Лесной клад',description:'Успешный раунд со светлячками приносит ещё 5 монет.'},
 squirrel:{title:'Ловкий прыжок',description:'Обычная игра стоит 12 энергии вместо 15.'},
 badger:{title:'Бережная забота',description:'Кормление стоит 4 монеты вместо 5.'},
 whale:{title:'Облачная мудрость',description:'Кормление даёт 15 опыта вместо 10.'},
 lynx:{title:'Полярное вдохновение',description:'Обычная игра даёт ещё 3 опыта: всего 33 в форме хранителя.'},
 griffin:{title:'Звёздная находка',description:'Обычная игра даёт 4 монеты вместо 3.'},
};
export function careStats(petId:PetId|null,guardian:boolean){
 return {feedCost:guardian&&petId==='badger'?4:5,feedEnergy:guardian&&petId==='deer'?25:20,feedXP:guardian&&petId==='whale'?15:10,playEnergy:guardian&&petId==='squirrel'?12:15,playXP:25+(guardian?5:0)+(guardian&&petId==='lynx'?3:0),playCoins:guardian&&petId==='griffin'?4:3};
}
