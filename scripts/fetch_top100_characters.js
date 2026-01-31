const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'top100anime_characters.json');
const ANILIST_API = 'https://graphql.anilist.co';

async function fetchTop100Anime() {
    console.log('Fetching Top 100 Anime...');
    let allAnime = [];

    // Explicitly fetch page 1 and 2 to get 100 anime (max 50 per page usually)
    for (let page = 1; page <= 2; page++) {
        console.log(`Fetching page ${page}...`);
        const query = `
        query {
            Page(page: ${page}, perPage: 50) {
                media(sort: POPULARITY_DESC, type: ANIME) {
                    id
                    title {
                        romaji
                        english
                    }
                    popularity
                }
            }
        }
        `;

        try {
            const response = await fetch(ANILIST_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                console.error(`Page ${page} failed: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error('Response:', text);
                continue;
            }

            const json = await response.json();
            if (json.data && json.data.Page.media) {
                allAnime = allAnime.concat(json.data.Page.media);
            }
            // Delay to respect rate limits (AniList: 90/min)
            await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
        }
    }

    return allAnime;
}

async function fetchCharactersForAnime(animeId) {
    let characters = [];
    let hasNextPage = true;
    let page = 1;

    // Limit to 2 pages (approx 50-100 characters) per anime to avoid rate limits and massive file size for now
    // User asked for "all available", but for 100 anime, we must be careful. 
    // Let's try to get up to 50 sorted by favorites (most popular characters).
    const query = `
    query ($id: Int, $page: Int) {
        Media(id: $id) {
            characters(page: $page, perPage: 25, sort: FAVOURITES_DESC) {
                pageInfo {
                    hasNextPage
                }
                nodes {
                    id
                    name {
                        full
                    }
                    image {
                        large
                    }
                    favourites
                }
            }
        }
    }
    `;

    // We will do just 2 pages (50 chars) per anime to be safe on rate limits (90 requests/min usually)
    // 100 anime * 2 requests = 200 requests. We need delays.
    while (hasNextPage && page <= 2) {
        try {
            const response = await fetch(ANILIST_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    query,
                    variables: { id: animeId, page }
                })
            });

            // Check for rate limit headers if possible, or just catch 429
            if (response.status === 429) {
                console.log('Rate limited! Waiting 60 seconds...');
                await new Promise(r => setTimeout(r, 60000));
                continue; // Retry same page
            }

            const json = await response.json();
            if (json.data && json.data.Media) {
                const charData = json.data.Media.characters;
                characters = characters.concat(charData.nodes);
                hasNextPage = charData.pageInfo.hasNextPage;
                page++;
            } else {
                break;
            }

            // Be nice to API: 1 second delay
            await new Promise(r => setTimeout(r, 800));

        } catch (error) {
            console.error(`Error fetching characters for anime ${animeId}:`, error);
            break;
        }
    }
    return characters;
}

async function main() {
    const animeList = await fetchTop100Anime();
    console.log(`Found ${animeList.length} anime.`);

    const allCharacters = [];

    for (const anime of animeList) {
        console.log(`Fetching characters for: ${anime.title.romaji}`);
        const chars = await fetchCharactersForAnime(anime.id);

        // Tag them with the anime title for easier reference later
        const taggedChars = chars.map(c => ({
            ...c,
            sourceAnime: {
                id: anime.id,
                title: anime.title.romaji
            }
        }));

        allCharacters.push(...taggedChars);
        console.log(`  -> Got ${chars.length} characters.`);
    }

    console.log(`Total characters fetched: ${allCharacters.length}`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCharacters, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

main();
