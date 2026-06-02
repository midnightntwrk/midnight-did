{ linkFarm, fetchurl }:

let
  baseUrl = "https://midnight-s3-fileshare-dev-eu-west-1.s3.eu-west-1.amazonaws.com";
  makeCircuitParam = name: sha256: {
    inherit name;
    path = fetchurl {
      url = "${baseUrl}/${name}";
      inherit sha256;
    };
  };
  circuitParams = [
    {
      name = "bls_midnight_2p1";
      sha256 = "sha256-u+BP48cNDBOER8sIa0ut3DDLi7KgBBFLwC5vc5UWKA4=";
    }
    {
      name = "bls_midnight_2p2";
      sha256 = "sha256-gOFVaPoaARfbiTI5vn+l40przDqMO/p3CVNLnLiOtsE=";
    }
    {
      name = "bls_midnight_2p3";
      sha256 = "sha256-S+gnpkchk9+A2PCLSyWoW670Nv3Rll2Jtq+J9OxOmeI=";
    }
    {
      name = "bls_midnight_2p4";
      sha256 = "sha256-Iy9AH60Qx934go0qpMhcZQbF2gl5WZjOyuufdfyPato=";
    }
    {
      name = "bls_midnight_2p5";
      sha256 = "sha256-ChySKfMV/Bho/yX2aPuDrsTQn08jpwa1GXxpLGGdcsY=";
    }
    {
      name = "bls_midnight_2p6";
      sha256 = "sha256-zyrWvn0P7fW+wqqjX2vkrKMwU9dCaP31qlT8sokept8=";
    }
    {
      name = "bls_midnight_2p7";
      sha256 = "sha256-6CrokMCAGINV83/q/+kTclhM2BBhUILZFD1N7ART/Z0=";
    }
    {
      name = "bls_midnight_2p8";
      sha256 = "sha256-kJtwdVHqrqeYKOiDzeb8RqsVmGw7HXkb7UYsnigFyTM=";
    }
    {
      name = "bls_midnight_2p9";
      sha256 = "sha256-uQCfEJi87//sPEYas6XjoX9+VZnw8Ixw/NxVqJInvL0=";
    }
    {
      name = "bls_midnight_2p10";
      sha256 = "sha256-RrIpCTPL7Uw3iInkupcfGpKIgzH/sJRmrNT/YaHiy0I=";
    }
    {
      name = "bls_midnight_2p11";
      sha256 = "sha256-mQFYnXlW/1i+DYVWmy9FW3e1jDdYAm/7W75IBwALltE=";
    }
    {
      name = "bls_midnight_2p12";
      sha256 = "sha256-7wjrP89i349yxRXP+gJ+aBgItTDLAW7qEEEVVF721cg=";
    }
    {
      name = "bls_midnight_2p13";
      sha256 = "sha256-0zJJEJacTMVBQ7gEW2SeXDpL1ft7j4X+G3cPZAzhyAM=";
    }
    {
      name = "bls_midnight_2p14";
      sha256 = "sha256-/CUwFoheyDDpeAjJ7JILtcq1whr1kDgKbLXrBTjiskQ=";
    }
    {
      name = "bls_midnight_2p15";
      sha256 = "sha256-ckx8PXeRSLsRPH7pwDSy8n2xbmvfMV/ekBBam60Asd4=";
    }
    {
      name = "bls_midnight_2p16";
      sha256 = "sha256-Cch3IW1libNwJj4Yr0CgMKkBtBp6fDfvWMmQHbQfBcY=";
    }
    {
      name = "bls_midnight_2p17";
      sha256 = "sha256-Sp72x8Bhmqt07t5EsT51PjulRQigLdO3EGqUmqu3O3Q=";
    }
    {
      name = "bls_midnight_2p18";
      sha256 = "sha256-6ENtxdi1mPFpwSfHRRNdiJdEAH5tOE/xJt+NEzJSL4Y=";
    }
  ];
in
linkFarm "midnight-circuit-params" (map (p: makeCircuitParam p.name p.sha256) circuitParams)
