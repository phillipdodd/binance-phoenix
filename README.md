[NeDB-promises](https://github.com/bajankristof/nedb-promises)


Goals for next test:

1. start session
2. place market buy order for strategy-specified quantity
3. leave running, watch for errors
4. stops when price exceeds price range

questions

does it stop when it exceeds price range?
does it stop when it hits order limit?
does it play nice with manually placed orders?

# Todo

database needs to store whether or not it is doing to re-list and, if not, why
## Styling Changes
* all module.exports need to happen at the end of file after class definition
* test files make all the try/catches obsolete