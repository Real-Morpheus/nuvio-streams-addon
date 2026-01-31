const fetch = require('node-fetch');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

async function searchMovie() {
    const query = 'The Rip';
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            console.log('--- FOUND MOVIES ---');
            data.results.forEach(m => {
                console.log(`Title: ${m.title}, ID: ${m.id}, Year: ${m.release_date}`);
            });
        } else {
            console.log('No movies found.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

searchMovie();
