const db =require('./mysql-connection')

const fetchURL=(customalias)=>{
    db.query( `SELECT * FROM users WHERE customAlias=${customalias}`, (err, results)=>{
        if(err)
        {
            console.log(err)
        }
        console.log("Test Query Results:",results)
    })
}