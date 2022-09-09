grammar Tests
import "./common"
import "./requirements"

entry TestModel:
    (tests+=Test)*;

Test:
    'tst' name=ID ('testFile' '=' testFile=STRING ('testMethod' '=' testMethod=STRING)?)?
    'tests' requirements+=[Requirement:ID]
    (',' requirements+=[Requirement:ID])*;
