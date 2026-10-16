import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foldPlaceText, matchOsmCoordinate, parseStreetHouse } from './matchOsmCoordinates.js'

const subway = {
  name: 'Subway',
  street: 'Ve Vaňkovce',
  house: '1',
  lat: 49.1875844,
  lon: 16.6143831,
  amenity: 'fast_food',
  website: 'https://www.sendvice.com/',
}

describe('párování souřadnic z OSM', () => {
  it('číslo v názvu ulice nesebere jako číslo domu a zkratku nám. srovná', () => {
    assert.deepEqual(parseStreetHouse('náměstí 28. dubna 10/40, 635 00 Brno'), {
      street: 'náměstí 28. dubna',
      house: '10/40',
    })
    assert.equal(foldPlaceText('nám. Svobody'), foldPlaceText('náměstí Svobody'))
    assert.equal(foldPlaceText('Moravské nám.'), foldPlaceText('Moravské náměstí'))
  })

  it('spáruje jednoznačný název a adresu, dva blízké body stejného podniku sloučí', () => {
    const smile = matchOsmCoordinate(
      {
        name: 'Kavárna - cukrárna Smile s.r.o.',
        address: 'náměstí 28. dubna 10/40, 635 00 Brno',
        website: 'https://www.cukrarna-kvetiny.cz/',
      },
      [
        {
          name: 'Kavárna - cukrárna Smile s.r.o.',
          street: 'náměstí 28. dubna',
          house: '10/40',
          lat: 49.2268447,
          lon: 16.5303144,
          amenity: 'cafe',
        },
      ],
    )
    assert.deepEqual(smile, { lat: 49.226845, lon: 16.530314, coordSource: 'osm' })

    const campus = matchOsmCoordinate(
      { name: 'Campus river', address: 'Palachovo náměstí 2, 62500 Brno' },
      [
        {
          name: 'Campus river',
          street: 'Palachovo náměstí',
          house: '2',
          lat: 49.1757397,
          lon: 16.5661294,
          amenity: 'restaurant',
        },
        {
          name: 'Campus river',
          street: 'Palachovo náměstí',
          house: '2',
          lat: 49.1757507,
          lon: 16.5659174,
          amenity: 'cafe',
        },
      ],
    )
    assert.equal(campus.lat, 49.17574)
    assert.equal(campus.lon, 16.566129)
  })

  it('web řetězce nepřiřadí jiné pobočce a bez jednoznačného bodu nevrátí souřadnici', () => {
    const records = [
      {
        name: 'Smash burgers',
        street: '',
        house: '',
        lat: 49.223751,
        lon: 16.5977143,
        website: 'https://smashburgersbrno.cz/',
      },
      { name: 'Smash Burgers', street: '', house: '', lat: 49.1973412, lon: 16.6079138 },
      { name: 'Scala', street: 'Moravské náměstí', house: '3', lat: 49.1972612, lon: 16.6082515 },
    ]
    const smash = matchOsmCoordinate(
      {
        name: 'Smash burgers Moravské náměstí',
        address: 'Moravské nám. 4, 602 00 Brno',
        website: 'https://smashburgersbrno.cz/',
      },
      records,
    )
    assert.deepEqual(smash, { lat: 49.197341, lon: 16.607914, coordSource: 'osm' })

    const forky = matchOsmCoordinate(
      {
        name: "Forky's Galerie Vaňkovka",
        address: 'Ve Vaňkovce 1, 602 00 Brno (Galerie Vaňkovka)',
        website: 'https://www.forkys.cz/pobocka/oc-vankovka/',
      },
      [
        subway,
        { name: "Forky's", street: '', house: '', lat: 49.1876106, lon: 16.6145147, website: 'https://www.forkys.cz/' },
        {
          name: "Forky's",
          street: 'Technická',
          house: '17',
          lat: 49.2245479,
          lon: 16.5791333,
          website: 'https://www.forkys.cz/',
        },
      ],
    )
    assert.deepEqual(forky, { lat: 49.187611, lon: 16.614515, coordSource: 'osm' })

    assert.equal(
      matchOsmCoordinate(
        { name: "Mama's Burger", address: 'Lazaretní 1/7, 615 00 Brno', website: 'https://mamasburgerbrno.cz/' },
        [{ name: 're.SET', street: 'Lazaretní', house: '925/9', lat: 49.19, lon: 16.62 }],
      ),
      null,
    )
  })
})
