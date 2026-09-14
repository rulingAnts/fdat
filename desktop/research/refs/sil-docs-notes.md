# Statements from SIL FieldWorks documentation (relevant to storing FDAT data)

Sources were supplied by the project owner (the SIL sites are unreachable from the research
container). Quotes are verbatim; page/line references are to the text extracted from the PDFs.

## Technical Notes on FieldWorks Send/Receive (Ken Zook, edited 13 Aug 2026; also the 25 Oct 2018 edition)
URL: https://downloads.languagetechnology.org/fieldworks/Documentation/Technical%20Notes%20on%20FieldWorks%20Send-Receive.pdf

§3.6 Linked files:
> Pictures, sound files, and other linked files are included in the S/R process as long as they are stored under the default LinkedFiles directory inside the FieldWorks project directory. FLEx allows you to use an external directory for linked files … But if you have chosen this approach, they will not be included in S/R. Also, because repo size and time for S/R … the S/R process currently limits files to 10 Mb, and only accepts certain file extensions. For images, it accepts these extensions: bmp, jpg, jpeg, gif, png, tif, tiff, ico, wmf, pcx, and cgm. For audio, it accepts these extensions: wav, snd, au, aif, aifc, aiff, wma, mp3, and webm. Anything that doesn't meet these requirements is skipped during S/R. A warning message will be given in the S/R log if files are greater than 10 Mb. Files with doc and txt extensions are included, but mp4 files are not.

Reading against the Chorus source (LargeFileFilter.cs, DefaultFileTypeHandler.cs, FlexFolderSystem.cs): the extension lists above are the ones that get the 10 MiB limit; an extension no handler claims (e.g. `.json`) is not excluded by pattern (only video, xml, zip and backup/temp extensions are) but gets the default 1 MiB limit, and is merged as an opaque file (conflict note, merging machine's copy wins). The document's "anything that doesn't meet these requirements is skipped" is a simplification; its own next sentence ("doc and txt … are included") matches the code's behaviour for unlisted small files.

§1 merge semantics:
> If colleagues change the same piece of data … the program will merge the changes the best it can (e.g., picking one of the two definitions), then add a conflict report warning the users … the user will need to fix the appropriate data manually.
> Merges use a 3-way process that can generally tell whether the change was an addition by one user, a deletion by one user, or a modification by both users.

§3.2 General concepts:
> In FLEx, every 'object' has a unique id. … The merge process basically adds any new objects, and merges the contents of existing objects with identical ids. … if my colleague changed something on that same entry or sense, the merge process doesn't want to potentially lose some important work, so the object I deleted will remain after the merge with the change my colleague made, and a merge conflict report will be added.
> Conflict information is stored in special XML files (*.ChorusNotes) that are merged along with the data.

§4.8 Modifying FLEx lists outside of FLEx: describes editing the split files (`General\UserDefinedLists\*.list`, each item an `<ownseq class="CmCustomItem" guid=…>`) in the Chorus Hub/USB repo with Mercurial and picking the change up through S/R, then running Tools > Utilities > "Write Everything" so missing required attributes are added. Shows that (a) SIL considers repo-level edits of split files a supported (if advanced) path, and (b) objects need only class, guid, and Name/Abbreviation to be valid list items.

§4.5.3: each text and each list is one file in the repo; replacing a split file with an earlier or modified version and syncing is a documented repair technique, with the caveat that guid references between files must still resolve.

## "Using Send/Receive" (software.sil.org/fieldworks/support/using-sendreceive/)
> Things included in S/R: Everything in the fwdata file: all lexical, interlinear, grammar, research notebook, and imported scripture data, styles, custom field definitions, and list of writing systems … All dictionary/reversal configurations … All picture/media files that are less than 10Mb. During S/R you'll get a blue warning if files are too big and not being sent. The LexiconSettings file in SharedSettings … .fwlayout files under ConfigurationSettings.
> Things not included in S/R: The user-chosen dictionary/reversal view. Picture/media files over 10Mb (or any files not stored in the project LinkedFiles folder) … Program settings: *.xml files in ConfigurationSettings including size and position of windows and panes, columns being shown in entries and bulk edit panes, interlinear configurations, filters, currently selected view, last tool and record used on closing, etc.
> FLExBridge merges data together the best it can, but if two changes are made to the same object, one is picked and it might not be the one you want. … send/receive keeps the data entered by the current user. A conflict message is generated …
> If one user modifies an entry, sense, etc. at the same time as another user deletes that same item, send/receive will keep the modification rather than the deletion.

## FLEx 9.3 Help, "Send/Receive overview"
> As a general rule, data are included when you use the send/receive feature; Personal settings, such as views, are not included.
> Do not change the Linked Files folder location.
> "Technical Notes on FieldWorks Send-Receive" is available under Resources on the Help menu.

## Other SIL technical documents worth reading for this design (not yet obtained)
From https://software.sil.org/fieldworks/help/technical-documents/ :
- FLEx 9.1 Conceptual model (10 Feb 2026): https://downloads.languagetechnology.org/fieldworks/Documentation/FLEx%209.1%20Conceptual%20Model.pdf
- FieldWorks 7 XML model (16 Jul 2015): https://downloads.languagetechnology.org/fieldworks/Documentation/FieldWorks_7_XML_model.pdf
- Model 7000072 classes and fields; FieldWorks model diagrams (chm)
- Technical Notes on FLEx Text Interlinear (4 May 2026): https://downloads.languagetechnology.org/fieldworks/Documentation/Technical%20Notes%20on%20FLEx%20Text%20Interlinear.pdf
- Interlinear text in Flex (10 Feb 2026): https://downloads.languagetechnology.org/fieldworks/Documentation/Interlinear%20text%20in%20Flex.pdf
- Python for FlexTools and FLEx 9.1 (15 Aug 2024): https://downloads.languagetechnology.org/fieldworks/Documentation/Python%20for%20FlexTools%20and%20FLEx%209.1.pdf
- Collaboration and networking (FW6, 16 Apr 2010): https://downloads.languagetechnology.org/fieldworks/Documentation/Collaboration_and_networking.pdf

## What this settles for FDAT
- A per-chart JSON under `<project>/LinkedFiles/Others/fdat/` does sync, provided the project keeps the default Linked Files location and the file stays well under 1 MiB (per-chart files are kilobytes). Merge is whole-file, merging machine wins, with a conflict note; fine for one analyst per chart.
- Custom field definitions and all model data sync as part of the fwdata split files with per-object, per-field merging, which is why custom fields on chart classes are the better home for per-row values.
- Anything in `ConfigurationSettings` (except `.fwlayout`), and anything outside the project folder, is per-machine.
