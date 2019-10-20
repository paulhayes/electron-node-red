![](img/LockkeeperTitleBlack.png)
![](img/LockkeeperBlack.png)

Lockkeeper is an open source [GPL v3.0 License](License.md) application intended to provide Escape Room creators and easy to use off the shelf tool for developing, controlling and deploying their projects.

It's features include 
* Dashboard
* Timer
* Logging
* Force unlocks
* Communication checking

## Quick Start

Download a latest release from the releases page. Please note, this project is an Alpha. There is still a work in progress with no stable release with the first full set of features. 

But if you want to play along, please join us, feature suggestions are welcome on the Issues page.

## Getting Started 

If you'd like support for node-red packages, you'll need to install nodejs. This is so Lockkeeper can use npm ( node package manager ).

If you'd like to version control your project, please install [git](). 

Node RED will detect when these are available and enable the extra features in the node RED menu ( top right ).


## Building yourself

Alternatively you can clone and build the project yourself.

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

```bash
# Clone this repository
git clone https://github.com/dceejay/electron-node-red.git
# Go into the repository
cd electron-node-red
# Install dependencies and run the app
npm install && npm run clean && npm start
```

## TL:DR - building runtimes

On OSX you can run `./buildall` to build binaries of "everything"... maybe...

Run `npm run pack` to create packages for all platforms - these are the files required to run, they are not binary installers.

Builds are created in the `build` directory. Runtimes are created in the `../electron-bin` directory.

**Note**: this was written to work on a Mac... other tools may/will be needed on other platforms.

## Packaging your application

If you want to distribute executables of this project, the easiest way is to use electron-builder:

```
npm run dist
```

## License [GPLv3](LICENSE.md)

## See also
 - **Stand-alone Starter Project** - https://github.com/dceejay/node-red-project-starter
 - **Bluemix Starter Project** - https://github.com/dceejay/node-red-bluemix-starter
