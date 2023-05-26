import { $ } from 'zx';
import * as dotenv from 'dotenv';
import { join, parse, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
$.verbose = false;
dotenv.config();
const { SERVER_URL, REVALIDATE_TOKEN } = process.env;
if (!SERVER_URL || !REVALIDATE_TOKEN) {
    console.error('enviroment variable SERVER_URL and REVALIDATE_TOKEN are required');
    process.exit(1);
}
const BLOG_UPDATE_PATH = join(SERVER_URL, '/api/blog/update');
const META_UPDATE_PATH = join(SERVER_URL, '/api/meta/update');
const updateBlog = async (blog) => {
    try {
        const resp = await fetch(BLOG_UPDATE_PATH, {
            method: 'POST',
            headers: { REVALIDATE_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify(blog),
        });
        if (resp.status !== 200) {
            throw await resp.json();
        }
        else {
            console.log('update blog success');
        }
    }
    catch (error) {
        console.error('update blog failed', error);
    }
};
const updateMeta = async (meta) => {
    try {
        const resp = await fetch(META_UPDATE_PATH, {
            method: 'POST',
            headers: { REVALIDATE_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify(meta),
        });
        if (resp.status !== 200) {
            throw await resp.json();
        }
        else {
            console.log('update meta success');
        }
    }
    catch (error) {
        console.error('update meta failed', error);
    }
};
const CURRENT_DIRECTORY = process.cwd();
const META_FILE = resolve(CURRENT_DIRECTORY, '.meta');
if (!existsSync(META_FILE)) {
    mkdirSync(META_FILE);
    writeFileSync(META_FILE, '{}');
}
const readJsonFile = (file) => {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    catch (error) {
        return {};
    }
};
const list = readJsonFile(META_FILE);
await $ `git config --local core.quotepath false`;
const files = (await $ `git diff --cached --name-only --diff-filter=ACM`).stdout.split('\n').filter(Boolean);
const mdFiles = files.filter((file) => file.endsWith('.md'));
mdFiles.forEach(file => {
    list[file] ??= { post: Date.now() };
    list[file].update = Date.now();
});
// update .meta file
writeFileSync(META_FILE, JSON.stringify(list, null, 2));
await $ `git add ${META_FILE}`;
// update server file
const updates = files.reduce((memo, file) => {
    const { dir, name } = parse(file);
    if (dir === 'meta') {
        memo.meta.push({
            type: name,
            content: readFileSync(resolve(CURRENT_DIRECTORY, file), 'utf8'),
        });
    }
    else if (dir === 'blogs') {
        memo.blogs.push({
            ...list[file],
            title: name,
            content: readFileSync(resolve(CURRENT_DIRECTORY, file), 'utf8'),
        });
    }
    return memo;
}, { meta: [], blogs: [] });
const requests = [];
updates.blogs.length && requests.push(updateBlog(updates.blogs));
updates.meta.length && requests.push(updateMeta(updates.meta));
await Promise.all(requests);
