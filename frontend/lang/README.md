# Localization of Pluto
We want to make Pluto and Julia more accessible to a wider audience! Since 0.20.14 (August 2025), Pluto has a *localization* system, which means that the Pluto UI interface can be used in a different language (English, Greek, etc). Because the Pluto developers only speak a couple of languages, we rely on **contributions from the community** to make Pluto available in more languages!

<img width="933" height="463" alt="Scherm­afbeelding 2025-08-11 om 22 56 30" src="https://github.com/user-attachments/assets/713bc887-2911-4faf-af07-2b33ef294c32" />

_Here is a screenshot of Pluto in Greek! Also notice that one piece of text in the middle (`Enter cell code...`) has not been localized yet, so it uses English as a fallback._

Do you want to help localize Pluto? Awesome!! Here is **How it works**, and **How to contribute**.

## Why contribute?
Localizing Pluto is a great way to help the Julia community, because it makes Julia more accessible to a much wider audience. Pluto is used around the world, but Julia and Pluto can still be hard to use for people who don't speak English.

We also want to break the tradition that "programming is in English". Programming is for everyone, and we hope that computers can be used regardless of language and culture.

Your work is also an **open source** contribution! Because you contribute localizations via git and github, you will be listed in the Pluto contributors list (https://github.com/JuliaPluto/Pluto.jl), and in the Pluto release notes (https://github.com/JuliaPluto/Pluto.jl/releases).



## Collaboration
The Pluto developers are really grateful for your help in localizing Pluto! 🌟 And we are super excited to collaborate with you! 

The ability to localize Pluto is quite new, and there will still be rough edges. Feel free to reach out whenever you want, and we will try to help you quickly! You can email us, open an issue, open a draft PR, whatever you prefer!

We are really interested in a right-to-left language (like Arabic or Farsi). This might require some additional tweaking, so reach out if you are interested to contribute, and we can work together to support it!


## How it works

The frontend of Pluto is uses [i18next](https://www.i18next.com/) to manage localizations, with a standard JSON format for localizations. The JSON files are in this folder.

For example, here is a part of `ellinika.json`, for the Greek language:

```js
    "t_edit_or_run_view_code_cancel": "{{icon}} Ακύρωση",
    "t_edit_or_run_description_1": "Για να μπορέσετε να επεξεργαστείτε κώδικα και να εκτελέσετε κύτταρα, πρέπει να εκτελέσετε το σημειωματάριο μόνοι σας.",
    "t_edit_or_run_description_2": "Πού θα θέλατε να εκτελέσετε το σημειωματάριο;",
    "t_binder_help_text_title": "Στο cloud <em>(πειραματική λειτουργία)</em>",
```

The Pluto UI uses these entries to display text, depending on the language. The right JSON file is picked for the user, and the text is taken from there. For each language, we have one JSON file.

### Partial localization
Important to know: partial localization is also welcome!! If the JSON file just has a couple of lines, then the language will be selected and those words are used, but English is used as a fallback. (We might make the fallback language customizable in the future!)

### How it works in JavaScript
Every piece of user-facing text in the Pluto frontend goes through the `t` function, which returns a string in the user's preferred language. For example, if we want to `confirm` to ask the user something, then we DON'T USE:

```js
if(confirm("Are you sure you want to delete this cell?")) {
    // ...
}
```

Instead, we use:

```js
if(confirm(t("t_delete_cell_confirm"))) {
    // ...
}
```

The function `t` then returns the right string, taken from one of the JSON files in this directory. If the language is set to `en`, then it will return the string `"Are you sure you want to delete this cell?"`. If the language is set to `nl`, then it will return the string `"Weet je zeker dat je deze cel wilt verwijderen?"`.

By using `t` throughout Pluto's code, we can make any piece of text translatable!


### Localization strings
Take a look at some of the other localization files (JSON) to see the structure! Important to know:

#### Interpolation
Some strings include **interpolation**, like `"Welcome to {{pluto_logo}}"`. The frontend uses this to insert special content in these places. In your translation, be sure to include the exact same interpolation, but you can decide where it goes. For example, you can translate it to `"{{pluto_logo}} heet U welkom!"`.

#### Pluralization
If the interpolated variable is `count`, then it will be a number, and you might want to provide different strings based on the number to account for **pluralization**. For example, `"You have {{count}} new messages"`.

You use the `_one`, `_other`, `_zero`, `_two`, `_few`, `_many`, and `_other` suffixes to indicate the plural form of the string. For example, in the JSON file:

```json
"t_new_messages_zero": "You have no new messages 🥺",
"t_new_messages_one": "You have {{count}} new message",
"t_new_messages_other": "You have {{count}} new messages"
```





## How to contribute

Before you start, take a look at [the Issues and PRs labeled "language"](https://github.com/JuliaPluto/Pluto.jl/issues?q=label%3Alanguage). Someone else might already be working on this language, and you could collaborate!


### Initial setup:
1. Fork the Pluto.jl repository
2. Clone your fork, we recommend GitHub Desktop. Let's say that you cloned it to `~/Desktop/Pluto.jl`
3. Create a new branch for your contribution

### How to contribute:
4. Run `julia update_languages.jl` to synchronize the JSON files with the English file. This will add new keys to the JSON files as empty strings, which you can then fill in.
4. You can **edit the JSON files in this directory** to add text. 🌟
5. When you are done, commit, push, and submit a pull request to the main Pluto.jl repository.


### Test: try it in Pluto!

To see your language in action while you are working on it:
1. In Julia, run `] dev ~/Desktop/Pluto.jl`. You now added your local copy of Pluto as a development package to your global Pkg environment. _(When you are done, you can run `] add Pluto` to go back to the normal Pluto installation.)_
2. Start Pluto as usual. It should say `"It looks like your are developing the Pluto package, using the unbundled frontend."` in the terminal.
3. Every time that you refresh the Pluto window, it will use your new text!


## Writing tips
Here is some advice for writing good localized text:
- Open `english.json` and your target language JSON file side by side, so you can see the original text and your new text at the same time.
- If you want to see where a localization is used, you can search for the key in the Pluto codebase. This shows the place in our code where it is used. Don't try to understand the code, just try to figure out where it is used in the Pluto frontend.
- If you are not sure about a localization, you can ask the Pluto developers for help.
- Microsoft provides a repository with localization strings from their products: https://learn.microsoft.com/en-us/globalization/reference/microsoft-language-resources#ui-strings

### Style guide
Feel free to get creative! You don't need to match the English text exactly, just make sure that the idea gets conveyed clearly.

With Pluto, we try to keep an **informal and clear style**, using simple and positive language. What would that look like in your language?

If your language contains gender-specific words, please make an effort to use gender-neutral language. (In some languages, this means being careful to not assume that the user is masculine.) We want Pluto to feel inclusive!

## Using AI
Feel free to use AI to help with writing the localization strings. (For example, copy the complete JSON file into ChatGPT and ask kindly for a translation.) But we do ask you to **check every localization string** yourself, and make sure that it is correct.

Also think about the **writing style**. Does the AI generate text in a style (formality, tone, etc) that you want? If not, try to tweak the prompt to get closer to the style you want.

> ### Previous experiences _(feel free to edit)_
> @fonsp and @pankgeorg both used AI in different ways to help with their localization work. 
> 
> @fonsp used Cursor Tab (AI autocomplete), but found it only a bit useful. But he thinks that it was sometimes nicer and more fun to think of the text yourself. 
> 
> @pankgeorg used Claude Code to generate the full json file at once, and then tweaked it manually. He was pretty happy with the result.
> 
> @rgouveiamendes used Copilot to translate all the values in the json file from English to Portuguese. Then, he reviewed each string. Few changes were needed. Executing the local copy of Pluto led to some final refinements.

## Modifying existing languages
You are free to modify existing localization strings contributed by other people, if you see a way to improve! For large changes, we ask you to contact previous authors and find a consensus together.

## New languages
If you want to contribute a new language/dialect that does not yet have a JSON file, then go for it! The Pluto developers are happy to set this up for you, but you can also try it yourself. Take a look at how another language (like "nederlands_nl" (`nl-NL`)) is set up, and copy the structure.

**All languages and dialects are welcome!** Even if the language is not spoken by many people, or less represented in the scientific programming world, we would really like your contribution!

Your language might require additional support, like Right-To-Left or other typography features. The Pluto developers are more than happy to work together with you to make this happen!

### Creating a new JSON file
Create a new JSON file for your language. Put in the following:

```json
{
    "t_language_name": "Ελληνικά",
}
```

and replace `Ελληνικά` with the name of your language (written in your language, not English).

Now run `julia update_languages.jl` to fill in the rest of the file with empty strings. Now you can start working on the file!
