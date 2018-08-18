# USE CASE

Suppose we have a package (project) like that:
````
index.html
project.js
gulpfile.js
style.css
package.json
install-here.json
app
  |-- app.md
assets
  |-- image.jpg
  |-- icon.ico
````

on a git repository:
````
https://github.com/myname/my-project
````
published as `my-project`.

First of all install install-here globally:
````
$ npm install install-here -g
````

Now you can `clone` the project in a local folder:
- create the folder `/my/project/sample`
- in this folder run command
    ````
    $ install-here my-project
    ````
    note: you can choose a specific version:
    ````
    $ install-here my-project@1.0.23
    ````

Now in folder you have a copy of the project and, on the root, a file `install-here.json`.
This file contains name and version of original package you have cloned:
````
{
  "name": "my-project",
  "version": "1.0.23",
  "ignore": "",
  "ignoreOverwrite": "app/**;index.html",
  "ignorePath": "app/**",
  "checkVersion": true,
  "xpost": "gulp update-version"
}
````

- `ignore`: not implemented;
- `ignoreOverwrite`: if index.html doesn't exists it will be created otherwise ignored.
    The folder `app` and all its content will be cloned if doesn't exists otherwise ignored;
- `ignorePath`: every file in this paths will be skipped if the path exists;
- `checkVersion`: if the version is the same as the remote one all commands will be skipped;

The `package.json` on root can be used to specify name, version, dependencies, ecc.. of the new project you are going to develop.

NOTE: the `package.json` file is implicitly included in the `ignoreOverwrite` group.

When the original project is published with version 1.1.4, we want to update our project to this version.
This is very simple to do, in the project folder run command:
````
$ install-here
````

so we are going to update these files:
````
project.js
gulpfile.js
style.css
assets
  |-- image.jpg
  |-- icon.ico
new-folder
  |-- newfile.js
````

all the following files will not be updated:
````
index.html
package.json
install-here.json
app
  |-- app.md
  |-- all-other-new-files.xxx
  |-- all-other-new-folders
````

install-here.json file contains now:
````
{
  "name": "my-project",
  "version": "1.1.4",
  ...
}
````

Therefore the project can grow in the `app` folder while the rest is kept updated to the original.
