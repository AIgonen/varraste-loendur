-- Testmudeli fail asub repos app/public/model.onnx (mitte yolo11n.onnx).
-- Rakendus loeb faili nime aktiivse mudeli realt, seega peab see klappima.
update model_version set file_name = 'model.onnx' where tag = 'coco_test';
