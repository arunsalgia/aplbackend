const { getRootDir, getFileName, 
  fileExist, renameFile, deletefile,
  setVersionNumber, getVersionNumber, 
  cleanup
} =  require("./functions.js");

// SET STORAGE
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname.toUpperCase());  // Date.now() + '-' +file.originalname)
  }
})
const upload = multer({ storage: storage }).single('file');


const gfsStorage = new GridFsStorage({
  url: mongoose_conn_string,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
        const filename = file.originalname;
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
    });
  }
});
const gfsUpload = multer({ gfsStorage });


var router = express.Router();


/* GET users listing. */
router.use('/', function(req, res, next) {
  setHeader(res);
  if (!db_connection) { senderr(res, DBERROR, ERR_NODB); return; }
  next('route');
});

router.get('/resetproject', async function (req, res, next) {
  setHeader(res);

  let allProducts = await Product.find({});
  let xxx = Product.deleteMany({});
  for(let p=0; p<allProducts.length; ++p) {
    let myFile = getFileName(allProducts[p].name, 
      allProducts[p].versionNumber,
      allProducts[p].type
      );
    deletefile(myFile);
  }
  await xxx;
  sendok(res, "Done");
}); 

router.get('/confirmlatest/:pname/:ptype/:pversion', async function (req, res, next) {
  setHeader(res);
  var {pname, ptype, pversion} = req.params;
  let isLatest = false;

  let returnObject;

  let myProduct = await Product.find({
    name: pname.toUpperCase(),
    type: ptype.toUpperCase(),
    // version: pversion
  }).limit(1).sort({ "versionNumber": -1 })
  // console.log(myProduct);

  if (myProduct.length > 0) {
    returnObject = myProduct[0];
    let clientversion = getVersionNumber(pversion);
    if (myProduct[0].versionNumber <= clientversion)
      isLatest = true;
  } 

  sendok(res, {status: isLatest, latest: returnObject});
}); 


router.get('/getimagenames', async function (req, res, next) {
  setHeader(res);

  let myData = {player: [], team: []};
  
  let data = await Player.find({},{uid: true, _id: false});
  myData.player = _.map(data, 'uid');
  myData.player = _.sortBy(myData.player);
  
  data = await Team.find({},{name: true, _id: false});
  myData.team = _.map(data, 'name');
  myData.team = _.sortBy(myData.team);

  sendok(res, myData);

}); 

router.get('/getbinarynames', async function (req, res, next) {
  setHeader(res);

  let myData = await Product.find({});
  let allProducts = [];
  let myProds = _.map(myData, 'name');
  myProds = _.uniqBy(myProds);
  myProds = _.sortBy(myProds);

  for(let p = 0; p<myProds.length; ++p) {
    let myVer = _.filter(myData, x => x.name === myProds[p]);
    myVer = _.sortBy(myVer, 'versionNumber').reverse();
    allProducts.push({name: myProds[p], version: myVer });
  }
  sendok(res, allProducts);
}); 

router.post('/uploadimage/:fileType/:fileName', async function (req, res) {
  setHeader(res);
  var {fileType, fileName} = req.params;
  fileType = fileType.toUpperCase();
  fileName = fileName.toUpperCase();

  upload(req, res, async (err) => {
    if (err) return res.sendStatus(500);

    let xxx = fileName.split(".");
    let myObject;
    if (fileType.includes("PLAYER")) {
      myObject = await Player.findOne({uid: xxx[0]});
      if (!myObject) {
        myObject = new Player();
        myObject.uid = parseInt(xxx[0]);
        myObject.name = xxx[0];
      }
    } else {
      myObject = await Team.findOne({name: xxx[0].toUpperCase()});
      if (!myObject) {
        myObject = new Team();
        myObject.uid = 0; 
        myObject.name = xxx[0].toUpperCase();
      }
    } 

    var filePath = getRootDir() + ARCHIVEDIR + fileName;
    console.log(filePath);
    myObject.image = {
      data: fs.readFileSync(filePath),
      contentType: 'image/jpg'
    }
    await myObject.save();
  
    // now delete the file
    deletefile(filePath);

    return  sendok(res, 'File uploaded');                //res.send('File uploaded!');
    });
    
  return;
})

router.get('/downloadimage/:fileType/:fileName', async function (req, res) {
  setHeader(res);

  var {fileType, fileName} = req.params;
  fileType = fileType.toUpperCase();
  fileName = fileName.toUpperCase();

  let myObject;
  if (fileType.includes("PLAYER")) {
    myObject = await Player.findOne({uid: parseInt(fileName)})  
  } else if (fileType.includes("TEAM")) {
    let x = fileName.split(".");
    myObject = await Team.findOne({name: x[0]});
  } 

  // console.log(myObject);
  if (myObject) {
    myFile = getRootDir() + ARCHIVEDIR + "DOWNLOADIMAGE.JPG"
    fs.writeFileSync(myFile, myObject.image.data);
    res.contentType("application/x-msdownload");
    res.status(200).sendFile(myFile);
  } else
    senderr(res, 500, "Image not found");
})


router.post('/uploadbinary/:pname/:ptype/:pversion/:fileName', async function (req, res) {
  setHeader(res);

  var {pname, ptype, pversion, fileName} = req.params;
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  fileName = fileName.toUpperCase();
  
  if ((ptype !== "EXE") && (ptype !== "APK"))
    return senderr(res, 501, "Invalid file type");

  upload(req, res, async (err) => {
    if (err)  return res.sendStatus(502);

    // file successfully uploaded
    let versionNumber = getVersionNumber(pversion);
    let origFileName  = getRootDir() + ARCHIVEDIR + fileName;
    let newFileName   = getFileName(pname, versionNumber, ptype);
    
    console.log(origFileName);
    console.log(newFileName);
  
    // deletefile(newFileName);       will be handled by rename file
    renameFile(origFileName, newFileName);

    let myBinary = await Product.findOne({
      name: pname,
      type: ptype,
      versionNumber: versionNumber
    });
    // console.log(myBinary);

    if (!myBinary) {
      myBinary = new Product();
      myBinary.name = pname;
      myBinary.type = ptype;
      myBinary.text = pversion;
      myBinary.version = pversion;
      myBinary.versionNumber = versionNumber;
    }
    // console.log(myBinary);
    myBinary.save();

    console.log("At fag end");
    return  sendok(res, 'File uploaded');                //res.send('File uploaded!');  
  });

  return;
})

router.get('/downloadbinary/:pname/:ptype/:pversion', async function (req, res) {
  setHeader(res);
  var {pname, ptype, pversion} = req.params;
  
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(pname, ptype, pversion);
  
  // console.log(fileName);
  // let x = await Team.find({})
  // console.log(x);

  let myObject = await Product.findOne({name: pname, type: ptype, version: pversion});

  if (myObject) {
    // console.log(myObject);
    // myFile = getRootDir() + "public/" + pname + "_" + myObject.versionNumber + "." + ptype;
    myFile = getFileName(pname, myObject.versionNumber, ptype);
    console.log(myFile);
    res.contentType("application/x-msdownload");
    res.status(200).sendFile(myFile);
  } else
    senderr(res, 500, "Image not found");  
})

router.get('/downloadlatestbinary/:pname/:ptype', async function (req, res) {
  setHeader(res);
  var {pname, ptype, pversion} = req.params;
  
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(pname, ptype, pversion);
  
  let myProduct = await Product.find({
    name: pname.toUpperCase(),
    type: ptype.toUpperCase(),
    // version: pversion
  }).limit(1).sort({ "versionNumber": -1 })
  
  if (myProduct.length === 0) return senderr(res, 501, "No product available");

  let myFile = getFileName(pname, myProduct[0].versionNumber, ptype);
  console.log(myFile);

  if (fileExist(myFile)) {
    res.contentType("application/x-msdownload");
    res.status(200).sendFile(myFile);
  } else
    senderr(res, 502, "Image not found");  
})

router.get('/purgeproduct/:pname/:ptype', async function (req, res) {
  setHeader(res);
  var {pname, ptype} = req.params;
  
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(pname, ptype);
  
  // get sorted product list with higest version first
  let myProduct = await Product.find({
    name: pname,
    type: ptype,
  }).sort({ "versionNumber": -1 })
  
  // now purge
  // delete all except the 1st i.e. with index 0
  for(p=1; p<myProduct.length; ++p) {
    await Product.deleteOne({
      name: myProduct[p].name,
      versionNumber: myProduct[p].versionNumber,
      type: myProduct[p].type
    });

    let myFile = getFileName(myProduct[p].name, myProduct[p].versionNumber, myProduct[p].type);
    // console.log(myFile);
    deletefile(myFile);
  }
  sendok(res, "Done");
})


router.get('/deleteproduct/:pname/:ptype/:pversion', async function (req, res) {
  setHeader(res);
  var {pname, ptype, pversion} = req.params;
  
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(pname, ptype, pversion);
  
  let myProduct = await Product.findOne({
    name: pname,
    type: ptype,
    version: pversion
  });
  
  if (myProduct) {
    await Product.deleteOne({
      name: pname,
      type: ptype,
      version: pversion
    });

    let myFile = getFileName(myProduct.name, myProduct.versionNumber, myProduct.type);
    console.log(myFile);
    deletefile(myFile);
  }
  sendok(res, "Done");
})


router.get('/setproducttext/:pname/:ptype/:pversion/:ptext', async function (req, res) {
  setHeader(res);
  var {pname, ptype, pversion, ptext} = req.params;
  
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(ptext);
  console.log(pname, ptype, pversion);

  let myProduct = await Product.findOne({
    name: pname,
    type: ptype,
    version: pversion
  });
  
  if (myProduct) {
    myProduct.text = ptext;
    myProduct.save();
    sendok(res, "Updated text");
  } else {
    senderr(res, 501, "Not found");
  }
})


router.get('/feedback/:userid/:message', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);
  
    let { userid, message } = req.params;
    let tDate = new Date();
    let userRec = await User.findOne({uid: userid})
	let aplRec = new Apl();
	aplRec.aplCode = tDate.getTime();
	aplRec.date = cricDate(tDate)
	aplRec.uid = userid;
	aplRec.message = `feedback from ${userRec.displayName} (${userRec.uid}) on ${tDate}` ;
	aplRec.email = userRec.email;
	aplRec.status = "PENDING";
	aplRec.save();
	//console.log(aplRec);
	
	// now send the mail 
  let resp = await sendCricMail(APLEMAILID, aplRec.message, decrypt(message));
  if (resp.status) {
    sendok(res, aplRec._id);
  } else {
    console.log(resp.error);
    senderr(res, 603, resp.error);
  }
}); 

router.get('/master/list', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);

  let myData = await MasterData.find({});
  sendok(res, myData);
});

router.get('/getfile/:myFileName', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);
  let { myFileName } = req.params;
  console.log(myFileName);
  myFileName = decrypt(myFileName);
  console.log(myFileName);
  sendok(res, myFileName);
});


router.get('/master/add/:myKey/:myValue', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);
  let { myKey, myValue } = req.params;
  
  let myData = await MasterData.findOne({msKey: myKey.toUpperCase()});
  if (!myData) {
    myData = new MasterData();
    let tmp = await MasterData.find({}).limit(1).sort({ msId: -1 });
    myData.msId = (tmp.length > 0) ? tmp[0].msId + 1 : 1;
    myData.msKey = myKey.toUpperCase();
  }
  myData.msValue = myValue;
  myData.save();
  sendok(res, myData);
});

router.get('/master/delete/:myKey', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);
  let { myKey } = req.params;
  
  try {
    await MasterData.deleteOne({msKey: myKey.toUpperCase()});
    sendok(res, `Key ${myKey} successfully delete from Master Settings`);
  } catch (e) {
    senderr(res, 601, `Key ${myKey} not found in Master Settings`);
  }
});


function sendok(res, usrmsg) { res.send(usrmsg); }
function senderr(res, errcode, errmsg) { res.status(errcode).send(errmsg); }
function setHeader(res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

module.exports = router;
