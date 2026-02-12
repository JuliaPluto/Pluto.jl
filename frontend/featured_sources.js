export default {
    // check out https://github.com/JuliaPluto/pluto-developer-instructions/blob/main/How%20to%20update%20the%20featured%20notebooks.md to learn more
    sources: [
        {
            url: "https://featured.plutojl.org/pluto_export.json",
            // this is one month before the expiry date of our domain registration at njal.la
            valid_until: "2027-10",
            id: "featured pluto",
        },
        {
            id: "featured pluto",
            url: "https://cdn.jsdelivr.net/gh/JuliaPluto/featured@v5/pluto_export.json",
            integrity: "sha256-+zI9b/gHEIJGV/DrckBY85hkxNWGIewgYffkAkEq4/w=",
        },
        {
            url: "https://plutojl.org/pluto_export.json",
            // this is one month before the expiry date of our domain registration at njal.la
            valid_until: "2027-10",
            id: "pluto website",
        },
    ],
}
