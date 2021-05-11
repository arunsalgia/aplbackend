// const { encrypt, decrypt, dbencrypt, dbdecrypt, dbToSvrText, svrToDbText, sendCricMail, } = require('./cricspecial'); 

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

var ROOTDIR="";
function getRootDir() {
  if (ROOTDIR === "")
    ROOTDIR = process.cwd() + "/"
  return ROOTDIR;
}

function getFileName(productName, productVersion, productType) {
  let myFile = getRootDir() + "public/" + 
    productName + "_" + 
    productVersion + "." + 
    productType;
  return myFile 
}

function fileExists(myFile) {
  status = fs.existsSync(myFile)
  return status;
}

function renameFile(oldfile, newFile) {
  // if new file already exists delete it
  if (fileExists(newFile))
    fs.unlinkSync(newFile);

    // now rename the file
  fs.renameSync(oldfile, newFile);
}


function nnn(sss) {
  let num = 0;
  // console.log("String os ", sss);
  if (sss)
  if (sss.length > 0)
    num = parseInt(sss);
  // console.log("number is ", num);
  return num;
}

function setVersionNumber(verNo) {
  let myStr = Math.trunc(verNo/10000).toString() + ".";
  verNo = verNo % 10000;
  myStr = myStr = Math.trunc(verNo/100).toString() + ".";
  verNo = verNo % 100;
  myStr = myStr + verNo.toString();
  return myStr;
}

function getVersionNumber(verStr) {
  let myNumber = 0;
  let tmp = verStr.split(".");
  // console.log("Tmp length ", tmp.length);
  if (tmp.length ===  3) {
    let num1 = nnn(tmp[0]);
    let num2 = nnn(tmp[1]);
    let num3 = nnn(tmp[2]);
    // console.log("Indi version ", num1, num2,  num3);
    myNumber = num1 * 10000 + num2 * 100 + num3;
  }
  return myNumber;
}


/* GET users listing. */
router.use('/', function(req, res, next) {
  // AplRes = res;
  setHeader(res);
  if (!db_connection) { senderr(res, DBERROR, ERR_NODB); return; }
  // console.log(req);
  next('route');
});

router.get('/resetproject', async function (req, res, next) {
  setHeader(res);

  Product.deleteMany({});
  sendok(res, "Done");
}); 

router.get('/confirmlatest/:pname/:ptype/:pversion', async function (req, res, next) {
  setHeader(res);
  var {pname, ptype, pversion} = req.params;
  let isLatest = false;

  let myProduct = await Product.find({
    name: pname.toUpperCase(),
    type: ptype.toUpperCase(),
    // version: pversion
  }).limit(1).sort({ "versionNumber": -1 })
  // console.log(myProduct);

  if (myProduct.length > 0) {
    if (myProduct[0].version === pversion)
      isLatest = true;
  } 

  sendok(res, {status: isLatest});
}); 


router.get('/getfilenames', async function (req, res, next) {
  setHeader(res);

  let myData = {bin: [], player: [], team: []};
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

    var filePath = getRootDir() + 'public/' + fileName;
    console.log(filePath);
    myObject.image = {
      data: fs.readFileSync(filePath),
      contentType: 'image/jpg'
    }
    await myObject.save();
  
    // now delete the file
    fs.unlinkSync(filePath);
    
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
    myFile = getRootDir() + "/public/DOWNLOADIMAGE.JPG"
    fs.writeFileSync(myFile, myObject.image.data);
    res.contentType("application/x-msdownload");
    res.status(200).sendFile(myFile);
  } else
    senderr(res, 500, "Image not found");
})

router.post('/orguploadbinary/:pname/:ptype/:pversion/:fileName', gfsUpload.single('file'), async (req, res, nxt) => {
  setHeader(res);
  var {pname, ptype, pversion, fileName} = req.params;
  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  fileName = fileName.toUpperCase();
  
  if ((ptype !== "EXE") && (ptype !== "APK"))
    return senderr(res, 501, "Invalid file type");

  // gfsUpload(req, res, (err) => {
  //   if (err) return senderr(res, 500, "No file provided");      //    res.sendStatus(500);
  // });

  let versionNumber = getVersionNumber(pversion);
  let origFileName  = getRootDir() + 'public/' + fileName;
  let newFileName   = getRootDir() + 'public/' + pname + "_" + versionNumber + "." + ptype;
  
  console.log(origFileName);
  console.log(newFileName);

  return sendok(res, "Binary done");

  let xxx = fileName.split(".");

  var filePath = getRootDir() + 'public/' + fileName;
  console.log(filePath);
  myObject.image = {
    data: fs.readFileSync(filePath),
    contentType: 'image/jpg'
  }
  await myObject.save();

  // now delete the file
  fs.unlinkSync(filePath);
  
  console.log("At fag end");
  return  sendok(res, 'File uploaded');                //res.send('File uploaded!');

  setHeader(res);

  console.log("In upload binary");

  pname = pname.toUpperCase();
  ptype = ptype.toUpperCase();
  console.log(pname, ptype, pversion);

  console.log(req.files);

  return sendok(res, "ok");

  if (!req.files)
    return senderr(res, 400, 'No files were uploaded.');

  if (!((ptype === "EXE") || (ptype === "APK")))
    return senderr(res, 401, 'Invalid product type.');

  let versionNUmber = getVersionNumber(pversion);
  let myObject = new Product();
  myObject.name = pname;
  myObject.type = ptype;
  myObject.version = pversion;
  myObject.versionNumber = versionNUmber;
  console.log(myObject);
  // await myObject.save();
  sendok(res, myObject);

  var sampleFile = req.files.file;
  sampleFile.name = sampleFile.name.toUpperCase();
  console.log("sampleFile: " + sampleFile.name);

  var filePath = getRootDir() + '/public/' + name + "_" + version + ".exe";
  console.log(filePath);

  sampleFile.mv(filePath, function(err) {
    if (err) {
      return senderr(res, 500, err);   //  return res.status(500).send(err);
    } 
    // else {
    //   sendok(res, 'File uploaded');                //res.send('File uploaded!');
    // }
  });

  const fileStream = fs.createReadStream(filePath)
        // upload file to gridfs
  const gridFile = new GridFile({ filename: "ARUN.exe" })
  await gridFile.upload(fileStream)

        // delete the file from local folder
  fs.unlinkSync(filePath)

  sendok(res, "OK")
  // console.log(fileType, folder);

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
    let origFileName  = getRootDir() + 'public/' + fileName;
    let newFileName   = getFileName(pname, versionNumber, ptype);
    
    console.log(origFileName);
    console.log(newFileName);
  
    if (fs.existsSync(newFileName))
      fs.unlinkSync(newFileName);
      
    renameFile(origFileName, newFileName);

    let myBinary = await Product.findOne({
      name: pname,
      type: ptype,
      versionNumber: versionNumber
    });
    console.log(myBinary);

    if (!myBinary) {
      myBinary = new Product();
      myBinary.name = pname;
      myBinary.type = ptype;
      myBinary.version = pversion;
      myBinary.versionNumber = versionNumber;
      console.log(myBinary);
      myBinary.save();
    }

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
    myFile = getRootDir() + "public/" + pname + "_" + myObject.versionNumber + "." + ptype;
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
    type: pname.toUpperCase(),
    // version: pversion
  }).limit(1).sort({ "versionNumber": -1 })
  
  if (myProduct.length === 0) return senderr(res, 501, "No product available");

  let myFile = getFileName(pname, myProduct[0].versionNumber, ptype);
  console.log(myFile);

  if (fileExists(myFile)) {
    res.contentType("application/x-msdownload");
    res.status(200).sendFile(myFile);
  } else
    senderr(res, 502, "Image not found");  
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

router.get('/support1', async function (req, res, next) {
  // AplRes = res;
  setHeader(res);

  let matchId = 1243388;
  let myTournament = 'indengt20-2021';
  let BriefStat = mongoose.model(myTournament+BRIEFSUFFIX, BriefStatSchema);
  var briefList = await BriefStat.find({ sid: 0 });
  briefList.forEach(x => {
    x.sid = matchId;
    //x.score = x.score/2; 
    x.save();
  });
  sendok(res, 'Done');
}); 


function sendok(res, usrmsg) { res.send(usrmsg); }
function senderr(res, errcode, errmsg) { res.status(errcode).send(errmsg); }
function setHeader(res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

module.exports = router;
