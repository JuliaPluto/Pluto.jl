# Pluto Frontend Bundler

We really like the fact that our frontend is usable without any compilation. (I've never had this little build-step problems 🙃). A tradeoff though, is that running Pluto normally requires an internet connection, is slow to start (as it has to crawl the whole module graph), and could be potentially broken by websites going down. So ideally we do have a bundler.. but also ideally we don't depend on a bundler..

Enter [Parcel](https://parceljs.org/).

Combined with a "custom resolver", parcel will crawl our normally functioning app, and download and bundle everything it finds on its way.

For that we have `parcel-resolver-like-a-browser`. It's a parcel resolver (name kinda gave it away uh), and a bit different to other parcel resolvers. Other resolvers are like:

> "Ohhh let me try to find it, and if I can't find it the next resolver can have a try

But I don't want to accidentally make something work with the bundler that doesn't work normally, so `parcel-resolver-like-a-browser` is very restrictive. It's our way or the highway.


# To run the bundlers:

```bash
cd frontend-bundler

npm install

rm -rf ../frontend/.parcel-cache
rm -rf ../frontend-dist
rm -rf ../frontend-dist-offline
npm run build
npm run build-offline
```