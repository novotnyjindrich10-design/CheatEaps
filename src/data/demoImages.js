/**
 * UKÁZKOVÉ fotografie z Unsplash – pouze pro demo MVP.
 * V produkci nahradit vlastními URL z API / CDN.
 */
const PHOTOS = {
  pizza: [
    'photo-1513104890138-7c749659a591',
    'photo-1574071318508-1cdbab80d002',
    'photo-1565299624946-b28f40a0ae38',
  ],
  burger: [
    'photo-1568901346375-23c9450c58cd',
    'photo-1572802419224-296b0aadf0b',
    'photo-1550547630-f32a4c3a2633',
  ],
  kebab: [
    'photo-1529006557810-274b9b822c31',
    'photo-1603360946369-dc9bb6258143',
    'photo-1599487488170-d11ec50cade7',
  ],
  asijske: [
    'photo-1617093727343-374698b1f2b4',
    'photo-1569718212165-3a8278d145f6',
    'photo-1582878826629-29ae27884f76',
  ],
  cina: [
    'photo-1585032226651-759b368d7246',
    'photo-1563245372-f21724e3856d',
    'photo-1526318896980-cf78c088247c',
  ],
  mexiko: [
    'photo-1565299585323-38d6b0865b47',
    'photo-1551504734-5ee1c4a1479b',
    'photo-1624300629298-e9de39c13be5',
  ],
  sladke: [
    'photo-1551024601-bec78aea704b',
    'photo-1578985545062-69928b1d9587',
    'photo-1486427944299-d1955d23e34d',
  ],
  zdrave: [
    'photo-1512621776951-a57141f2eefd',
    'photo-1490645935967-10de6ba17061',
    'photo-1540420773420-3366772f4999',
  ],
  fastfood: [
    'photo-1572802419224-296b0aadf0b',
    'photo-1626087923214-42e44056a60b',
    'photo-1551782450-a2132b4ba21d',
  ],
  vegetarianske: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1512621776951-a57141f2eefd',
    'photo-1498837167922-ddd27525d352',
  ],
  veganske: [
    'photo-1512621776951-a57141f2eefd',
    'photo-1540420773420-3366772f4999',
    'photo-1521305916502-4d14103bd6e9',
  ],
  ceske: [
    'photo-1626087923214-42e44056a60b',
    'photo-1604908176997-4318367a9349',
    'photo-1544025162-d76694265947',
  ],
  kava: [
    'photo-1495474472287-4d71bcdd2085',
    'photo-1509042239860-f550ce710b93',
    'photo-1442512595331-e89e73853f31',
  ],
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function demoFoodImage(category, seedId) {
  const pool = PHOTOS[category] ?? PHOTOS.ceske
  const photo = pool[hashString(String(seedId)) % pool.length]
  return `https://images.unsplash.com/${photo}?w=800&auto=format&fit=crop&q=80`
}
